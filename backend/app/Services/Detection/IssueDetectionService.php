<?php

namespace App\Services\Detection;

use App\Models\Setting;
use App\Models\Source;
use App\Models\Topic;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * One detection pass over the active topics for `issue` alerts (PRD §10.1, §10.9). A topic gets an
 * alert when the spike detector (F3) OR the coordination detector (F4) fires, and both signals feed one
 * score, so a topic never has two competing alerts.
 *
 * Order matters inside a chunk: coordination runs first and writes `anomalous_accounts`, then the spike
 * snapshot is read, so the score sees what coordination just found.
 *
 * One pass is idempotent: windows come from the data clock, the alert is an upsert and evidence is
 * deduplicated, so running it twice for the same clock changes nothing.
 */
class IssueDetectionService
{
    private const TOPIC_CHUNK = 100;

    public function __construct(
        private SpikeDetectionService $spikes,
        private CoordinationDetectionService $coordination,
        private AlertWriter $alerts,
    ) {}

    /**
     * @return array{topics: int, triggered: int, spike: int, coordination: int, created: int, updated: int, cooldown: int, failed: int}
     */
    public function run(): array
    {
        $settings = Setting::detection();
        $now = DataClock::now();
        $activeSources = Source::where('is_active', true)->count();
        $stats = ['topics' => 0, 'triggered' => 0, 'spike' => 0, 'coordination' => 0, 'created' => 0, 'updated' => 0, 'cooldown' => 0, 'failed' => 0];

        Topic::query()->where('is_active', true)->chunkById(self::TOPIC_CHUNK, function (Collection $topics) use ($settings, $now, $activeSources, &$stats) {
            $coordinated = $this->coordination->detect($topics, $now, $settings);
            foreach ($topics as $topic) {
                if ($coordinated[$topic->id]['triggered']) {
                    $this->coordination->recordAnomalous($topic->id, $coordinated[$topic->id]);
                }
            }
            $snapshots = $this->spikes->snapshots($topics, $now, $settings);

            foreach ($topics as $topic) {
                $stats['topics']++;
                $spike = $snapshots[$topic->id]['spike'];
                $coordination = $coordinated[$topic->id];
                if (! $spike['triggered'] && ! $coordination['triggered']) {
                    continue;
                }
                $stats['triggered']++;
                $stats['spike'] += $spike['triggered'] ? 1 : 0;
                $stats['coordination'] += $coordination['triggered'] ? 1 : 0;

                // One topic failing must not stop the others; the job fails afterwards so it is retried.
                try {
                    $result = $this->raise($topic, $snapshots[$topic->id], $coordination, $now, $settings, $activeSources);
                    $stats[$result['outcome']]++;
                } catch (Throwable $e) {
                    $stats['failed']++;
                    Log::error('detection.issue.topic_failed', [
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
     * @param  array<string, mixed>  $snapshot  SpikeDetectionService::snapshots() entry
     * @param  array<string, mixed>  $coordination  CoordinationDetectionService::detect() entry
     * @param  array<string, mixed>  $settings
     * @return array{outcome: string, alert_id: int|null, evidence_added: int}
     */
    private function raise(Topic $topic, array $snapshot, array $coordination, CarbonImmutable $now, array $settings, int $activeSources): array
    {
        $spike = $snapshot['spike'];
        $input = [
            'z' => $spike['z'],
            'has_sufficient_baseline' => $spike['has_sufficient_baseline'],
            'negative_count' => $snapshot['window']['negative_count'],
            'volume' => $snapshot['window']['volume'],
            'source_count' => $snapshot['window']['source_count'],
            'active_sources' => $activeSources,
        ];
        if ($coordination['triggered']) {
            // Share of the accounts active in the coordination window that sit in a coordinated cluster.
            $input['anomalous_accounts'] = count($coordination['flagged_account_ids']);
            $input['unique_accounts'] = $coordination['accounts_in_window'];
        } else {
            $input['anomalous_accounts'] = $snapshot['hour']['anomalous_accounts'];
            $input['unique_accounts'] = $snapshot['hour']['unique_accounts'];
        }

        $scored = ThreatScorer::score($input, ThreatScorer::optionsFromSettings($settings));
        // The z shown as the threshold is the one this topic was held to, not the base setting.
        $scored['score_breakdown']['thresholds']['z'] = $spike['z_effective'];

        $spikeWindowStart = $now->subMinutes((int) $settings['spike_current_window_minutes']);
        $coordinationWindowStart = $now->subMinutes((int) $settings['coordination_window_minutes']);
        // The alert window opens where the earliest triggered detector's window opens.
        $starts = array_filter([
            $spike['triggered'] ? $spikeWindowStart : null,
            $coordination['triggered'] ? $coordinationWindowStart : null,
        ]);
        $windowStart = min($starts);

        $limit = (int) $settings['spike_sample_limit'];
        $evidence = [];
        if ($spike['triggered']) {
            $evidence = $this->spikeEvidence($topic->id, $spike, $spikeWindowStart, $now, $limit);
        }
        if ($coordination['triggered']) {
            array_push($evidence, ...$this->coordinationEvidence($coordination, $settings));
        }

        $cap = (int) $settings['coordination_max_posts'];

        return $this->alerts->upsertIssue(
            $topic->id, $scored, $windowStart, $now, $now, $evidence,
            (int) $settings['cooldown_minutes'],
            ['spike_sample' => $limit, 'similar_text' => $cap, 'young_account' => $cap, 'synchronized_posting' => $cap],
        );
    }

    /**
     * @param  array<string, mixed>  $spike
     * @return list<array<string, mixed>>
     */
    private function spikeEvidence(int $topicId, array $spike, CarbonImmutable $from, CarbonImmutable $to, int $limit): array
    {
        $evidence = [];
        $rank = 0;
        foreach ($this->spikes->samples($topicId, $from, $to, $limit) as $post) {
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

        return $evidence;
    }

    /**
     * One `similar_text` row per account of each coordinated cluster, plus `young_account` and
     * `synchronized_posting` where they hold (PRD §10.6 step 3). The numbers behind each row travel in
     * `detail`, so an analyst can see why the account was flagged.
     *
     * @param  array<string, mixed>  $coordination
     * @param  array<string, mixed>  $settings
     * @return list<array<string, mixed>>
     */
    private function coordinationEvidence(array $coordination, array $settings): array
    {
        $evidence = [];
        foreach ($coordination['clusters'] as $cluster) {
            $base = [
                'cluster_id' => $cluster['cluster_id'],
                'seed_post_id' => $cluster['seed_post_id'],
                'cluster_accounts' => $cluster['accounts_count'],
                'cluster_posts' => $cluster['posts_count'],
                'window' => $coordination['window'],
                'truncated' => $coordination['truncated'],
                'thresholds' => $coordination['thresholds'],
            ];

            foreach ($cluster['accounts'] as $accountId => $account) {
                $row = ['post_id' => $account['post_id'], 'account_id' => $accountId];
                $evidence[] = $row + ['reason' => 'similar_text', 'detail' => $base + [
                    'similarity' => $account['similarity'],
                    'account_posts' => $account['posts_count'],
                ]];
                if ($account['young']) {
                    $evidence[] = $row + ['reason' => 'young_account', 'detail' => $base + [
                        'account_age_days' => $account['age_days'],
                        'young_account_days' => (int) $settings['young_account_days'],
                    ]];
                }
                if ($account['synchronized']) {
                    $evidence[] = $row + ['reason' => 'synchronized_posting', 'detail' => $base + [
                        'synchronized' => $cluster['synchronized'],
                    ]];
                }
            }
        }

        return $evidence;
    }
}
