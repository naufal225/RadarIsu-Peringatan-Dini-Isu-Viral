<?php

namespace App\Services\Ingest;

use App\Models\ReplayScenario;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Scenario CSV → replay_scenarios + replay_rows (PRD §9.6, §10.10, §11). The scenario is a script on its own
 * time axis: `offset_seconds` counts from the start of the baseline, and the runner puts that axis on the
 * calendar when it starts.
 *
 * Columns: offset_seconds, phase (baseline|incident), text, account_handle (required);
 * account_display_name, account_age_days, label_manual (organic|anomalous) (optional).
 *
 * An account's age cannot be stored as a date, because the calendar position is not known until the run. It is
 * kept on the same axis as the offsets: account_created_at = VIRTUAL_EPOCH + offset - age. The runner maps it back
 * with `anchor + (account_created_at - VIRTUAL_EPOCH)`, so "created 2 days before the post" stays true on any run.
 *
 * A bad file is rejected as a whole (422, `file` = code, `rows` = "line:code"): a scenario with silently dropped
 * rows would give different detection and evaluation numbers on every upload.
 */
class ReplayScenarioImporter
{
    public const VIRTUAL_EPOCH = '1970-01-01 00:00:00+00';

    public const REQUIRED_COLUMNS = ['offset_seconds', 'phase', 'text', 'account_handle'];

    public const OPTIONAL_COLUMNS = ['account_display_name', 'account_age_days', 'label_manual'];

    public const MAX_ROWS = 50_000;

    public const MAX_OFFSET_SECONDS = 2_592_000;

    public const MAX_ROW_ERRORS = 50;

    private const MAX_TEXT_LENGTH = 10_000;

    private const MAX_FIELD_LENGTH = 190;

    private const MAX_ACCOUNT_AGE_DAYS = 36_500;

    private const INSERT_CHUNK = 1_000;

    /**
     * @param  array{name: string, description?: ?string, incident_start_offset_seconds?: ?int, default_speed_factor?: ?int}  $meta
     */
    public function import(string $path, array $meta, User $user): ReplayScenario
    {
        $rows = $this->parse($path);

        $incidentOffsets = array_column(array_filter($rows, fn (array $r) => $r['phase'] === 'incident'), 'offset_seconds');
        $incidentStart = $meta['incident_start_offset_seconds'] ?? min($incidentOffsets);

        return DB::transaction(function () use ($rows, $meta, $user, $incidentStart) {
            $scenario = ReplayScenario::create([
                'name' => $meta['name'],
                'description' => $meta['description'] ?? null,
                'total_rows' => count($rows),
                'incident_start_offset_seconds' => $incidentStart,
                'default_speed_factor' => $meta['default_speed_factor'] ?? 60,
                'status' => 'idle',
                'created_by' => $user->id,
            ]);

            $now = now();
            foreach (array_chunk($rows, self::INSERT_CHUNK) as $chunk) {
                DB::table('replay_rows')->insert(array_map(fn (array $row) => $row + [
                    'scenario_id' => $scenario->id, 'created_at' => $now, 'updated_at' => $now,
                ], $chunk));
            }

            return $scenario;
        });
    }

    /**
     * @return list<array{offset_seconds: int, phase: string, text: string, account_handle: string, account_display_name: ?string, account_created_at: ?string, label_manual: ?string}>
     */
    public function parse(string $path): array
    {
        $content = file_get_contents($path);
        if ($content === false || trim($content) === '') {
            $this->reject('empty_file');
        }
        $content = preg_replace('/^\xEF\xBB\xBF/', '', $content);
        if (! mb_check_encoding($content, 'UTF-8')) {
            $this->reject('invalid_encoding');
        }

        $handle = fopen('php://temp', 'r+');
        fwrite($handle, $content);
        rewind($handle);

        try {
            $line = 1;
            $columns = $this->validateHeader($this->readRecord($handle, $content, $line) ?? []);

            $rows = [];
            $errors = [];
            $total = 0;
            while (true) {
                $start = $line;
                $record = $this->readRecord($handle, $content, $line);
                if ($record === null) {
                    break;
                }
                if ($record === [null]) {
                    continue; // blank line
                }
                if (++$total > self::MAX_ROWS) {
                    $this->reject('too_many_rows');
                }
                if (count($record) !== count($columns)) {
                    $errors[] = "{$start}:column_count_mismatch";

                    continue;
                }

                $parsed = $this->row(array_combine($columns, $record));
                if (is_string($parsed)) {
                    $errors[] = "{$start}:{$parsed}";
                } else {
                    $rows[] = $parsed;
                }
            }
        } finally {
            fclose($handle);
        }

        if ($errors !== []) {
            throw ValidationException::withMessages([
                'file' => ['invalid_rows'],
                'rows' => array_slice($errors, 0, self::MAX_ROW_ERRORS),
            ]);
        }
        if ($rows === []) {
            $this->reject('no_rows');
        }

        $this->checkPhases($rows);
        usort($rows, fn (array $a, array $b) => $a['offset_seconds'] <=> $b['offset_seconds']);

        return $rows;
    }

    /**
     * The baseline is the history the incident is measured against, so it has to end before the incident begins.
     *
     * @param  list<array<string, mixed>>  $rows
     */
    private function checkPhases(array $rows): void
    {
        $baseline = array_column(array_filter($rows, fn (array $r) => $r['phase'] === 'baseline'), 'offset_seconds');
        $incident = array_column(array_filter($rows, fn (array $r) => $r['phase'] === 'incident'), 'offset_seconds');

        if ($incident === []) {
            $this->reject('no_incident_rows');
        }
        if ($baseline !== [] && max($baseline) > min($incident)) {
            $this->reject('baseline_after_incident');
        }
    }

    /**
     * @param  array<string, ?string>  $record
     * @return array<string, mixed>|string a row, or the error code
     */
    private function row(array $record): array|string
    {
        $get = function (string $column) use ($record): ?string {
            $value = trim((string) ($record[$column] ?? ''));

            return $value === '' ? null : $value;
        };

        $offset = $get('offset_seconds');
        if ($offset === null || ! preg_match('/^\d{1,7}$/', $offset) || (int) $offset > self::MAX_OFFSET_SECONDS) {
            return 'invalid_offset_seconds';
        }
        $phase = $get('phase');
        if (! in_array($phase, ['baseline', 'incident'], true)) {
            return 'invalid_phase';
        }
        $text = $get('text');
        if ($text === null) {
            return 'missing_text';
        }
        $accountHandle = $get('account_handle');
        if ($accountHandle === null) {
            return 'missing_account_handle';
        }
        $label = $get('label_manual');
        if ($label !== null && ! in_array($label, ['organic', 'anomalous'], true)) {
            return 'invalid_label_manual';
        }
        $age = $get('account_age_days');
        if ($age !== null && (! preg_match('/^\d{1,5}$/', $age) || (int) $age > self::MAX_ACCOUNT_AGE_DAYS)) {
            return 'invalid_account_age_days';
        }
        $displayName = $get('account_display_name');
        if (mb_strlen($text) > self::MAX_TEXT_LENGTH || mb_strlen($accountHandle) > self::MAX_FIELD_LENGTH
            || ($displayName !== null && mb_strlen($displayName) > self::MAX_FIELD_LENGTH)) {
            return 'field_too_long';
        }

        $created = $age === null ? null : CarbonImmutable::parse(self::VIRTUAL_EPOCH)
            ->addSeconds((int) $offset - (int) $age * 86_400)->format('Y-m-d H:i:sP');

        return [
            'offset_seconds' => (int) $offset,
            'phase' => $phase,
            'text' => $text,
            'account_handle' => $accountHandle,
            'account_display_name' => $displayName,
            'account_created_at' => $created,
            'label_manual' => $label,
        ];
    }

    /**
     * @param  resource  $handle
     * @return list<?string>|null
     */
    private function readRecord($handle, string $content, int &$line): ?array
    {
        $before = ftell($handle);
        $record = fgetcsv($handle, null, ',', '"', '');
        if ($record === false) {
            return null;
        }
        $line += substr_count($content, "\n", $before, ftell($handle) - $before);

        return $record;
    }

    /**
     * @param  list<?string>  $header
     * @return list<string>
     */
    private function validateHeader(array $header): array
    {
        $columns = array_map(fn ($c) => strtolower(trim((string) $c)), $header);

        if ($missing = array_diff(self::REQUIRED_COLUMNS, $columns)) {
            $this->reject('missing_columns:'.implode(',', $missing));
        }
        if ($unknown = array_diff($columns, [...self::REQUIRED_COLUMNS, ...self::OPTIONAL_COLUMNS])) {
            $this->reject('unknown_columns:'.implode(',', $unknown));
        }
        if (count($columns) !== count(array_unique($columns))) {
            $this->reject('duplicate_columns');
        }

        return $columns;
    }

    private function reject(string $code): never
    {
        throw ValidationException::withMessages(['file' => [$code]]);
    }
}
