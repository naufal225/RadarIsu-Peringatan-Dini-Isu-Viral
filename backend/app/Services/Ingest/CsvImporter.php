<?php

namespace App\Services\Ingest;

use App\Models\ImportBatch;
use App\Models\Source;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * CSV import into raw_items (PRD v2.2 §11). Columns mirror replay_rows so one normalizer
 * serves both (Phase 3). File-level problems reject the whole file (422) before anything
 * is written; row-level problems are reported per file line in import_batches.errors.
 */
class CsvImporter
{
    public const REQUIRED_COLUMNS = ['text', 'account_handle', 'posted_at'];

    public const OPTIONAL_COLUMNS = ['external_id', 'account_display_name', 'account_created_at'];

    public const MAX_ROWS = 50_000;

    public const MAX_ERRORS = 200;

    private const MAX_TEXT_LENGTH = 10_000;

    private const MAX_FIELD_LENGTH = 190;

    private const INSERT_CHUNK = 1_000;

    /** ISO 8601 with an explicit offset or Z; local times are ambiguous and rejected. */
    private const ISO_8601 = '/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,6})?)?(Z|[+-]([01]\d|2[0-3]):?[0-5]\d)$/';

    public function import(Source $source, string $path, string $filename, User $user): ImportBatch
    {
        [$total, $rows, $errors] = $this->parse($path);

        return DB::transaction(function () use ($source, $filename, $user, $total, $rows, $errors) {
            // Serialise imports per source so the duplicate check below cannot race.
            Source::whereKey($source->id)->lockForUpdate()->first();

            $existing = [];
            foreach (array_chunk(array_column($rows, 'hash'), self::INSERT_CHUNK) as $hashes) {
                $existing += array_flip(DB::table('raw_items')
                    ->where('source_id', $source->id)
                    ->whereIn('content_hash', $hashes)
                    ->pluck('content_hash')
                    ->all());
            }

            $fresh = [];
            foreach ($rows as $row) {
                if (isset($existing[$row['hash']])) {
                    $errors[] = ['row' => $row['line'], 'message' => 'duplicate_row'];
                } else {
                    $fresh[] = $row;
                }
            }

            usort($errors, fn (array $a, array $b) => $a['row'] <=> $b['row']);

            $batch = ImportBatch::create([
                'source_id' => $source->id,
                'filename' => $filename,
                'total_rows' => $total,
                'success_rows' => count($fresh),
                'failed_rows' => count($errors),
                'errors' => array_slice($errors, 0, self::MAX_ERRORS),
                'created_by' => $user->id,
            ]);

            $now = now();
            foreach (array_chunk($fresh, self::INSERT_CHUNK) as $chunk) {
                DB::table('raw_items')->insert(array_map(fn (array $row) => [
                    'source_id' => $source->id,
                    'import_batch_id' => $batch->id,
                    'external_id' => $row['payload']['external_id'],
                    'payload' => $row['json'],
                    'content_hash' => $row['hash'],
                    'fetched_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ], $chunk));
            }

            return $batch;
        });
    }

    /**
     * @return array{0: int, 1: list<array{line: int, payload: array<string, ?string>, json: string, hash: string}>, 2: list<array{row: int, message: string}>}
     */
    private function parse(string $path): array
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
            $header = $this->readRecord($handle, $content, $line);
            $columns = $this->validateHeader($header ?? []);

            $total = 0;
            $rows = [];
            $errors = [];
            $seen = [];

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
                    $errors[] = ['row' => $start, 'message' => 'column_count_mismatch'];

                    continue;
                }

                $payload = $this->payload(array_combine($columns, $record));
                if ($code = $this->rowError($payload)) {
                    $errors[] = ['row' => $start, 'message' => $code];

                    continue;
                }

                $json = $this->canonicalJson($payload);
                $hash = hash('sha256', $json);
                if (isset($seen[$hash])) {
                    $errors[] = ['row' => $start, 'message' => 'duplicate_row'];

                    continue;
                }
                $seen[$hash] = true;
                $rows[] = ['line' => $start, 'payload' => $payload, 'json' => $json, 'hash' => $hash];
            }
        } finally {
            fclose($handle);
        }

        return [$total, $rows, $errors];
    }

    /**
     * Reads one CSV record and advances $line by the newlines it spanned (quoted fields may contain newlines).
     *
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
        $allowed = [...self::REQUIRED_COLUMNS, ...self::OPTIONAL_COLUMNS];

        if ($missing = array_diff(self::REQUIRED_COLUMNS, $columns)) {
            $this->reject('missing_columns:'.implode(',', $missing));
        }
        if ($unknown = array_diff($columns, $allowed)) {
            $this->reject('unknown_columns:'.implode(',', $unknown));
        }
        if (count($columns) !== count(array_unique($columns))) {
            $this->reject('duplicate_columns');
        }

        return $columns;
    }

    /**
     * @param  array<string, ?string>  $record
     * @return array<string, ?string>
     */
    private function payload(array $record): array
    {
        $payload = [];
        foreach ([...self::REQUIRED_COLUMNS, ...self::OPTIONAL_COLUMNS] as $column) {
            $value = trim((string) ($record[$column] ?? ''));
            $payload[$column] = $value === '' ? null : $value;
        }

        return $payload;
    }

    /**
     * @param  array<string, ?string>  $payload
     */
    private function rowError(array $payload): ?string
    {
        if ($payload['text'] === null) {
            return 'missing_text';
        }
        if ($payload['account_handle'] === null) {
            return 'missing_account_handle';
        }
        if (! $this->isIso8601($payload['posted_at'])) {
            return 'invalid_posted_at';
        }
        if ($payload['account_created_at'] !== null && ! $this->isIso8601($payload['account_created_at'])) {
            return 'invalid_account_created_at';
        }
        if (mb_strlen($payload['text']) > self::MAX_TEXT_LENGTH) {
            return 'field_too_long';
        }
        foreach (['account_handle', 'external_id', 'account_display_name'] as $field) {
            if ($payload[$field] !== null && mb_strlen($payload[$field]) > self::MAX_FIELD_LENGTH) {
                return 'field_too_long';
            }
        }

        return null;
    }

    private function isIso8601(?string $value): bool
    {
        // The pattern bounds hours/minutes/seconds; checkdate() rejects days like 2026-02-31.
        return $value !== null
            && preg_match(self::ISO_8601, $value) === 1
            && checkdate((int) substr($value, 5, 2), (int) substr($value, 8, 2), (int) substr($value, 0, 4));
    }

    /**
     * @param  array<string, ?string>  $payload
     */
    private function canonicalJson(array $payload): string
    {
        ksort($payload);

        return json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    private function reject(string $code): never
    {
        throw ValidationException::withMessages(['file' => [$code]]);
    }
}
