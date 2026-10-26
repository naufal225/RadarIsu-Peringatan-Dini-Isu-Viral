<?php

namespace App\Services\Detection;

use App\Models\Setting;
use App\Models\Source;
use App\Models\Topic;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Runs the spike detector over the active topics (F3, PRD §10.5, §10.8, §10.9). All I/O lives here;
 * the decision is SpikeDetector and the score is ThreatScorer.
 *
 * One pass is idempotent: a window is derived from the data clock, the alert is an upsert and evidence
 * is deduplicated, so running it twice for the same clock changes nothing.
 */
class SpikeDetectionService
{
    private const TOPIC_CHUNK = 100;

    public function __construct(private AlertWriter $alerts) {}

    /**
     * @return array{topics: int, triggered: int, created: int, updated: int, cooldown: int, failed: int}
     */
    public function run(): array
    {
        $settings = Setting::detection();
        $now = DataClock::now();
        $activeSources = Source::where('is_active', true)->count();
        $stats = ['topics' => 0, 'triggered' => 0, 'created' => 0, 'updated' => 0, 'cooldown' => 0, 'failed' => 0];

        Topic::query()->where('is_active', true)->chunkById(self::TOPIC_CHUNK, function (Collection $topics) use ($settings, $now, $activeSources, &$stats) {
            $snapshots = $this->snapshots($topics, $now, $settings);

            foreach ($topics as $topic) {
                $stats['topics']++;
                $snapshot = $snapshots[$topic->id];
                if (! $snapshot['spike']['triggered']) {
                    continue;
                }
                $stats['triggered']++;

                // One topic failing must not stop the others; the job fails afterwards so it is retried.
                try {
                    $result = $this->raise($topic, $snapshot, $now, $settings, $activeSources);
                    $stats[$result['outcome']]++;
                } catch (Throwable $e) {
                    $stats['failed']++;
                    Log::error('detection.spike.topic_failed', [
                        'topic_id' => $topic->id,
                        'data_clock' => $now->toIso8601String(),
                        'exception' => $e::class,
                        'message' => $e->getMessage(),
                    ]);
                }
            }
        });

        return $stats;
    }

    /**
     * Spike decision and its inputs for the given topics, without writing anything.
     *
     * @param  Collection<int, Topic>  $topics
     * @param  array<string, mixed>  $settings
     * @return array<int, array{spike: array<string, mixed>, window: array<string, int>, hour: array<string, int>, baseline: list<int>}>
     */
    public function snapshots(Collection $topics, CarbonImmutable $now, array $settings): array
    {
        $ids = $topics->pluck('id')->all();
        $hourStart = $now->startOfHour();
        $baselineFrom = $hourStart->subHours((int) $settings['baseline_hours']);
        $windowStart = $now->subMinutes((int) $settings['spike_current_window_minutes']);

        $volumes = [];
        foreach (DB::table('metrics_hourly')->whereIn('topic_id', $ids)
            ->where('hour', '>=', $baselineFrom)->where('hour', '<', $hourStart)
            ->get(['topic_id', 'hour', 'volume']) as $row) {
            $volumes[$row->topic_id][CarbonImmutable::parse($row->hour)->getTimestamp()] = (int) $row->volume;
        }

        // History starts at the topic's first metrics hour: hours before it do not exist for the topic,
        // while a quiet hour after it has no row and counts as 0.
        $firstHours = DB::table('metrics_hourly')->whereIn('topic_id', $ids)->where('hour', '<', $hourStart)
            ->groupBy('topic_id')->selectRaw('topic_id, min(hour) as first_hour')->pluck('first_hour', 'topic_id');

        $windows = DB::table('topic_matches as m')->join('posts as p', 'p.id', '=', 'm.post_id')
            ->whereIn('m.topic_id', $ids)->where('p.posted_at', '>', $windowStart)->where('p.posted_at', '<=', $now)
            ->groupBy('m.topic_id')
            ->selectRaw("m.topic_id, count(*) as volume, count(*) FILTER (WHERE p.sentiment = 'negative') as negative_count,
                count(DISTINCT p.account_id) as unique_accounts, count(DISTINCT p.source_id) as source_count")
            ->get()->keyBy('topic_id');

        $hours = DB::table('metrics_hourly')->whereIn('topic_id', $ids)->where('hour', $hourStart)
            ->get(['topic_id', 'unique_accounts', 'anomalous_accounts'])->keyBy('topic_id');

        $snapshots = [];
        foreach ($topics as $topic) {
            $baseline = $this->baseline($volumes[$topic->id] ?? [], $firstHours[$topic->id] ?? null, $baselineFrom, $hourStart);
            $window = $windows[$topic->id] ?? null;
            $hour = $hours[$topic->id] ?? null;

            $snapshots[$topic->id] = [
                'spike' => SpikeDetector::evaluate((int) ($window->volume ?? 0), $baseline, $settings, $topic->sensitivity),
                'window' => [
                    'volume' => (int) ($window->volume ?? 0),
                    'negative_count' => (int) ($window->negative_count ?? 0),
                    'unique_accounts' => (int) ($window->unique_accounts ?? 0),
                    'source_count' => (int) ($window->source_count ?? 0),
                ],
                'hour' => [
                    'unique_accounts' => (int) ($hour->unique_accounts ?? 0),
                    'anomalous_accounts' => (int) ($hour->anomalous_accounts ?? 0),
                ],
                'baseline' => $baseline,
            ];
        }

        return $snapshots;
    }

    /**
     * Hourly volumes from the start of the topic's history to the running hour (exclusive), zero-filled.
     *
     * @param  array<int, int>  $volumeByHour  unix hour => volume
     * @return list<int>
     */
    private function baseline(array $volumeByHour, ?string $firstHour, CarbonImmutable $from, CarbonImmutable $hourStart): array
    {
        if ($firstHour === null) {
            return [];
        }

        $start = max(CarbonImmutable::parse($firstHour)->getTimestamp(), $from->getTimestamp());
        $series = [];
        for ($at = $start; $at < $hourStart->getTimestamp(); $at += 3600) {
            $series[] = $volumeByHour[$at] ?? 0;
        }

        return $series;
    }

    /**
     * @param  array{spike: array<string, mixed>, window: array<string, int>, hour: array<string, int>}  $snapshot
     * @param  array<string, mixed>  $settings
     * @return array{outcome: string, alert_id: int|null, evidence_added: int}
     */
    private function raise(Topic $topic, array $snapshot, CarbonImmutable $now, array $settings, int $activeSources): array
    {
        $spike = $snapshot['spike'];
        $scored = ThreatScorer::score([
            'z' => $spike['z'],
            'has_sufficient_baseline' => $spike['has_sufficient_baseline'],
            'anomalous_accounts' => $snapshot['hour']['anomalous_accounts'],
            'unique_accounts' => $snapshot['hour']['unique_accounts'],
            'negative_count' => $snapshot['window']['negative_count'],
            'volume' => $snapshot['window']['volume'],
            'source_count' => $snapshot['window']['source_count'],
            'active_sources' => $activeSources,
        ], ThreatScorer::optionsFromSettings($settings));
        // The z shown as the threshold is the one this topic was held to, not the base setting.
        $scored['score_breakdown']['thresholds']['z'] = $spike['z_effective'];

        $windowStart = $now->subMinutes((int) $settings['spike_current_window_minutes']);
        $limit = (int) $settings['spike_sample_limit'];

        $evidence = [];
        $rank = 0;
        foreach ($this->samples($topic->id, $windowStart, $now, $limit) as $post) {
            $evidence[] = [
                'reason' => 'spike_sample',
                'post_id' => $post->id,
                'account_id' => $post->account_id,
                'detail' => [
                    'rank' => ++$rank,
                    'posted_at' => CarbonImmutable::parse($post->posted_at)->toIso8601String(),
                    'current' => $spike['current'],
                    'current_rate' => $spike['current_rate'],
                    'baseline_mean' => $spike['mean'],
                    'baseline_std' => $spike['std'],
                    'baseline_hours' => $spike['baseline_hours'],
                    'z' => $spike['z'],
                    'thresholds' => $spike['thresholds'],
                ],
            ];
        }

        return $this->alerts->upsertIssue(
            $topic->id, $scored, $windowStart, $now, $now, $evidence,
            (int) $settings['cooldown_minutes'], ['spike_sample' => $limit],
        );
    }

    /**
     * Earliest posts of the window: a stable choice, so a rerun picks the same ones.
     *
     * @return Collection<int, object{id: int, account_id: int, posted_at: string}>
     */
    private function samples(int $topicId, CarbonImmutable $from, CarbonImmutable $to, int $limit): Collection
    {
        return DB::table('topic_matches as m')->join('posts as p', 'p.id', '=', 'm.post_id')
            ->where('m.topic_id', $topicId)->where('p.posted_at', '>', $from)->where('p.posted_at', '<=', $to)
            ->orderBy('p.posted_at')->orderBy('p.id')->limit($limit)
            ->get(['p.id', 'p.account_id', 'p.posted_at']);
    }
}
