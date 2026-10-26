<?php

namespace App\Services\Detection;

use App\Models\Topic;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Reads what the spike detector needs and returns its decision per topic (F3, PRD §10.5). All the I/O
 * of the spike detector lives here; the decision is SpikeDetector. IssueDetectionService runs it
 * together with the coordination detector and writes the alert.
 */
class SpikeDetectionService
{
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
     * Earliest posts of the window: a stable choice, so a rerun picks the same ones.
     *
     * @return Collection<int, object{id: int, account_id: int, posted_at: string}>
     */
    public function samples(int $topicId, CarbonImmutable $from, CarbonImmutable $to, int $limit): Collection
    {
        return DB::table('topic_matches as m')->join('posts as p', 'p.id', '=', 'm.post_id')
            ->where('m.topic_id', $topicId)->where('p.posted_at', '>', $from)->where('p.posted_at', '<=', $to)
            ->orderBy('p.posted_at')->orderBy('p.id')->limit($limit)
            ->get(['p.id', 'p.account_id', 'p.posted_at']);
    }
}
