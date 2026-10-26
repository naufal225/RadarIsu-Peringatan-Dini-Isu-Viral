<?php

namespace App\Services\Ingest;

use App\Jobs\NormalizePostsJob;
use App\Models\ReplayRow;
use App\Models\ReplayScenario;
use App\Models\Setting;
use App\Models\Source;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Replays a scenario through the normal pipeline (PRD §10.10): rows become raw_items of a `replay` source, then
 * NormalizePostsJob → MatchTopicsJob → AggregateMetricsJob → DetectJob do what they do for live data.
 *
 *  1. begin() puts the scenario in `running`, fixes `virtual_anchor_at` so that the baseline ends now, and
 *     picks the run number (`external_id` carries it, so a second run of the same scenario is new data).
 *  2. run() writes the baseline at once, then streams the incident in virtual-time order, waiting
 *     `Δoffset / speed_factor` real seconds between batches. After every batch `replay.clock.now` is moved to the
 *     latest `posted_at`; it goes back to null when the run ends, whichever way it ends.
 *
 * Only one scenario runs at a time (they share the one data clock; a partial unique index enforces it). A run whose
 * worker died stops counting after STALE_AFTER_SECONDS without a heartbeat and can be replaced.
 */
class ReplayRunner
{
    public const CLOCK_KEY = 'replay.clock';

    /** Rows whose offsets fall in the same virtual minute are delivered together. */
    public const BATCH_VIRTUAL_SECONDS = 60;

    public const STALE_AFTER_SECONDS = 120;

    private const HEARTBEAT_EVERY_SECONDS = 10;

    private const WRITE_CHUNK = 500;

    /**
     * @throws ReplayStateException
     */
    public function begin(ReplayScenario $scenario, int $speedFactor): ReplayScenario
    {
        try {
            return DB::transaction(function () use ($scenario, $speedFactor) {
                $this->releaseStale();

                $locked = ReplayScenario::whereKey($scenario->id)->lockForUpdate()->firstOrFail();
                if ($locked->status === 'running') {
                    throw new ReplayStateException('already_running');
                }
                if (! $locked->rows()->exists()) {
                    throw new ReplayStateException('empty_scenario');
                }

                $baselineEnd = (int) ($locked->rows()->where('phase', 'baseline')->max('offset_seconds') ?? 0);
                $now = CarbonImmutable::now('UTC');

                $locked->update([
                    'status' => 'running',
                    'speed_factor' => $speedFactor,
                    'run_number' => $locked->run_number + 1,
                    'progress_rows' => 0,
                    'started_at' => $now,
                    'virtual_anchor_at' => $now->subSeconds($baselineEnd),
                    'heartbeat_at' => $now,
                    'finished_at' => null,
                    'error' => null,
                    'source_id' => $this->source($locked)->id,
                ]);

                return $locked;
            });
        } catch (UniqueConstraintViolationException) {
            // replay_scenarios_one_running_uq: another scenario won the race.
            throw new ReplayStateException('another_running');
        }
    }

    /**
     * Runs a begun scenario to the end, or until its status is flipped to `stopped`.
     *
     * @param  ?callable(float): void  $sleep  Sleeps for N real seconds; the default really waits. Tests pass a no-op.
     * @param  ?callable(): void  $afterBatch  Called after every delivered batch (the sync command runs detection here).
     */
    public function run(ReplayScenario $scenario, ?callable $sleep = null, ?callable $afterBatch = null): void
    {
        $sleep ??= fn (float $seconds) => usleep((int) ($seconds * 1_000_000));
        $anchor = CarbonImmutable::parse($scenario->virtual_anchor_at)->utc();
        $speed = max(1, (int) $scenario->speed_factor);
        $source = Source::findOrFail($scenario->source_id);
        $delivered = 0;
        $lastBeat = microtime(true);

        try {
            $previousOffset = null;
            foreach ($this->batches($scenario) as $batch) {
                if ($batch['phase'] === 'incident' && $previousOffset !== null) {
                    $wait = ($batch['first_offset'] - $previousOffset) / $speed;
                    if (! $this->wait($scenario, $wait, $sleep, $lastBeat)) {
                        break;
                    }
                } elseif ($this->isStopped($scenario)) {
                    break;
                }

                $this->deliver($scenario, $source, $anchor, $batch['rows']);
                $delivered += count($batch['rows']);
                $previousOffset = $batch['last_offset'];

                $this->setClock($anchor->addSeconds($batch['last_offset']));
                ReplayScenario::whereKey($scenario->id)->update(['progress_rows' => $delivered, 'heartbeat_at' => now()]);
                $lastBeat = microtime(true);

                if ($afterBatch !== null) {
                    $afterBatch();
                }
            }

            $this->finish($scenario);
        } catch (Throwable $e) {
            $this->fail($scenario, $e);

            throw $e;
        }
    }

    /** Marks a run that stopped by itself (e.g. the job was killed) so it no longer blocks the next one. */
    public function fail(ReplayScenario $scenario, Throwable $e): void
    {
        ReplayScenario::whereKey($scenario->id)->where('status', 'running')->update([
            'status' => 'stopped', 'finished_at' => now(), 'error' => mb_substr($e->getMessage(), 0, 1000),
        ]);
        $this->setClock(null);
        Log::error('replay.failed', ['scenario_id' => $scenario->id, 'exception' => $e::class, 'message' => $e->getMessage()]);
    }

    /** The raw virtual clock setting (null when no replay is moving it). */
    public static function clockNow(): ?string
    {
        return Setting::find(self::CLOCK_KEY)?->value['now'] ?? null;
    }

    public function setClock(?CarbonImmutable $now): void
    {
        Setting::updateOrCreate(['key' => self::CLOCK_KEY], ['value' => ['now' => $now?->utc()->format('Y-m-d\TH:i:s\Z')]]);
    }

    /** Runs that stopped beating, from any scenario, are closed so the "one running" rule cannot jam. */
    private function releaseStale(): void
    {
        $stale = ReplayScenario::where('status', 'running')
            ->where(fn ($q) => $q->whereNull('heartbeat_at')->orWhere('heartbeat_at', '<', now()->subSeconds(self::STALE_AFTER_SECONDS)))
            ->update(['status' => 'stopped', 'finished_at' => now(), 'error' => 'heartbeat_lost']);

        if ($stale > 0) {
            $this->setClock(null);
        }
    }

    private function source(ReplayScenario $scenario): Source
    {
        if ($scenario->source_id !== null && ($existing = Source::find($scenario->source_id))) {
            return $existing;
        }

        // Inactive on purpose: a replay source must not count as a live source in the reach component.
        return Source::create([
            'type' => 'replay',
            'name' => 'Replay: '.$scenario->name,
            'config' => ['scenario_id' => $scenario->id],
            'is_active' => false,
            'is_simulated' => true,
            'last_status' => 'never',
            'created_by' => $scenario->created_by,
        ]);
    }

    /**
     * Baseline rows in big chunks, incident rows grouped by virtual minute.
     *
     * @return \Generator<int, array{phase: string, rows: list<ReplayRow>, first_offset: int, last_offset: int}>
     */
    private function batches(ReplayScenario $scenario): \Generator
    {
        $rows = [];
        foreach ($scenario->rows()->where('phase', 'baseline')->orderBy('offset_seconds')->orderBy('id')->lazyById(self::WRITE_CHUNK) as $row) {
            $rows[] = $row;
            if (count($rows) === self::WRITE_CHUNK) {
                yield $this->batch('baseline', $rows);
                $rows = [];
            }
        }
        if ($rows !== []) {
            yield $this->batch('baseline', $rows);
        }

        $rows = [];
        $windowStart = null;
        foreach ($scenario->rows()->where('phase', 'incident')->orderBy('offset_seconds')->orderBy('id')->lazyById(self::WRITE_CHUNK) as $row) {
            if ($windowStart !== null && $row->offset_seconds >= $windowStart + self::BATCH_VIRTUAL_SECONDS) {
                yield $this->batch('incident', $rows);
                $rows = [];
                $windowStart = null;
            }
            $windowStart ??= $row->offset_seconds;
            $rows[] = $row;
        }
        if ($rows !== []) {
            yield $this->batch('incident', $rows);
        }
    }

    /**
     * @param  list<ReplayRow>  $rows
     * @return array{phase: string, rows: list<ReplayRow>, first_offset: int, last_offset: int}
     */
    private function batch(string $phase, array $rows): array
    {
        $offsets = array_map(fn ($r) => $r->offset_seconds, $rows);

        return ['phase' => $phase, 'rows' => $rows, 'first_offset' => min($offsets), 'last_offset' => max($offsets)];
    }

    /**
     * Writes the rows as canonical raw_items and runs the normalizer on them right here. Normalizing inline keeps
     * the clock and the data in step, and a single queue worker cannot starve itself behind this long job.
     *
     * @param  list<ReplayRow>  $rows
     */
    private function deliver(ReplayScenario $scenario, Source $source, CarbonImmutable $anchor, array $rows): void
    {
        $now = now();
        $epoch = CarbonImmutable::parse(ReplayScenarioImporter::VIRTUAL_EPOCH)->getTimestamp();
        $format = fn (CarbonImmutable $t) => $t->utc()->format('Y-m-d\TH:i:s\Z');

        $items = [];
        foreach ($rows as $row) {
            $createdAt = $row->account_created_at === null
                ? null
                : $format($anchor->addSeconds($row->account_created_at->getTimestamp() - $epoch));

            // external_id ties a post back to its replay_rows line, and to the run that made it.
            $payload = [
                'text' => $row->text,
                'account_handle' => $row->account_handle,
                'posted_at' => $format($anchor->addSeconds($row->offset_seconds)),
                'external_id' => "replay:{$scenario->id}:{$scenario->run_number}:{$row->id}",
                'account_display_name' => $row->account_display_name,
                'account_created_at' => $createdAt,
                'label_manual' => $row->label_manual,
            ];
            $json = $this->canonicalJson($payload);

            $items[] = [
                'source_id' => $source->id,
                'external_id' => $payload['external_id'],
                'payload' => $json,
                'content_hash' => hash('sha256', $json),
                'fetched_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::table('raw_items')->insertOrIgnore($items);
        NormalizePostsJob::dispatchSync();
    }

    /**
     * Waits N real seconds in short slices so a stop request, and the heartbeat, are never more than a second late.
     *
     * @param  callable(float): void  $sleep
     * @return bool false when the scenario was stopped meanwhile
     */
    private function wait(ReplayScenario $scenario, float $seconds, callable $sleep, float &$lastBeat): bool
    {
        $remaining = $seconds;
        while (true) {
            if ($this->isStopped($scenario)) {
                return false;
            }
            if ($remaining <= 0) {
                return true;
            }

            $slice = min(1.0, $remaining);
            $sleep($slice);
            $remaining -= $slice;

            if (microtime(true) - $lastBeat >= self::HEARTBEAT_EVERY_SECONDS) {
                ReplayScenario::whereKey($scenario->id)->update(['heartbeat_at' => now()]);
                $lastBeat = microtime(true);
            }
        }
    }

    /** Same canonical form as CsvImporter, so a raw_item hashes the same way whichever path wrote it. */
    private function canonicalJson(array $payload): string
    {
        ksort($payload);

        return json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    private function isStopped(ReplayScenario $scenario): bool
    {
        return ReplayScenario::whereKey($scenario->id)->value('status') !== 'running';
    }

    private function finish(ReplayScenario $scenario): void
    {
        // A stop request already set `stopped`; only a run that reached the end becomes `finished`.
        ReplayScenario::whereKey($scenario->id)->where('status', 'running')->update(['status' => 'finished', 'finished_at' => now()]);
        ReplayScenario::whereKey($scenario->id)->whereNull('finished_at')->update(['finished_at' => now()]);
        $this->setClock(null);
        Log::info('replay.finished', ['scenario_id' => $scenario->id, 'run_number' => $scenario->run_number]);
    }
}
