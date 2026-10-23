<?php

namespace App\Services\Detection;

use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Hourly rollup of topic matches into metrics_hourly (PRD §9.4, §10.1). Hours are UTC.
 *
 * `anomalous_accounts` belongs to the CoordinationDetector (PRD §10.6 step 4): a new row starts at 0
 * and an update never touches it. Every method is idempotent and takes the window as an argument,
 * so it does not depend on the wall clock.
 */
class MetricsAggregator
{
    private const PAIR_CHUNK = 200;

    /**
     * @param  list<array{0: int, 1: string}>  $pairs  [topic_id, hour 'Y-m-d H:00:00' UTC]
     */
    public function recompute(array $pairs): void
    {
        foreach (array_chunk($pairs, self::PAIR_CHUNK) as $chunk) {
            $conditions = [];
            $bindings = [];
            foreach ($chunk as [$topicId, $hour]) {
                $conditions[] = '(m.topic_id = ? AND p.posted_at >= ?::timestamptz AND p.posted_at < ?::timestamptz + interval \'1 hour\')';
                array_push($bindings, $topicId, $hour.'+00', $hour.'+00');
            }
            $this->upsert('('.implode(' OR ', $conditions).')', $bindings);
        }
    }

    /**
     * Recomputes every hour that has posts at or after `$since` (truncated to the hour).
     */
    public function recomputeSince(CarbonInterface $since, ?int $topicId = null): void
    {
        $where = 'p.posted_at >= ?::timestamptz';
        $bindings = [$since->copy()->utc()->startOfHour()->format('Y-m-d H:i:s').'+00'];
        if ($topicId !== null) {
            $where .= ' AND m.topic_id = ?';
            $bindings[] = $topicId;
        }
        $this->upsert($where, $bindings);
    }

    /**
     * Recomputes all hours of one topic and drops the hours that no longer have any matching post.
     */
    public function rebuildTopic(int $topicId): void
    {
        $this->upsert('m.topic_id = ?', [$topicId]);
        $this->deleteEmptyHours($topicId);
    }

    /**
     * Recomputes everything, for every topic, and drops the hours without any matching post.
     */
    public function rebuildAll(): void
    {
        $this->upsert('TRUE', []);
        $this->deleteEmptyHours(null);
    }

    /**
     * @param  list<mixed>  $bindings
     */
    private function upsert(string $where, array $bindings): void
    {
        $now = now()->utc()->format('Y-m-d H:i:s.u').'+00';

        DB::statement(<<<SQL
            INSERT INTO metrics_hourly
                (topic_id, hour, volume, positive_count, negative_count, neutral_count,
                 unique_accounts, anomalous_accounts, source_count, created_at, updated_at)
            SELECT m.topic_id,
                   date_trunc('hour', p.posted_at),
                   count(*),
                   count(*) FILTER (WHERE p.sentiment = 'positive'),
                   count(*) FILTER (WHERE p.sentiment = 'negative'),
                   count(*) FILTER (WHERE p.sentiment IS DISTINCT FROM 'positive' AND p.sentiment IS DISTINCT FROM 'negative'),
                   count(DISTINCT p.account_id),
                   0,
                   count(DISTINCT p.source_id),
                   ?::timestamptz,
                   ?::timestamptz
            FROM topic_matches m
            JOIN posts p ON p.id = m.post_id
            WHERE {$where}
            GROUP BY m.topic_id, date_trunc('hour', p.posted_at)
            ON CONFLICT (topic_id, hour) DO UPDATE SET
                volume = EXCLUDED.volume,
                positive_count = EXCLUDED.positive_count,
                negative_count = EXCLUDED.negative_count,
                neutral_count = EXCLUDED.neutral_count,
                unique_accounts = EXCLUDED.unique_accounts,
                source_count = EXCLUDED.source_count,
                updated_at = EXCLUDED.updated_at
            SQL, [$now, $now, ...$bindings]);
    }

    private function deleteEmptyHours(?int $topicId): void
    {
        DB::statement(<<<'SQL'
            DELETE FROM metrics_hourly h
            WHERE (?::bigint IS NULL OR h.topic_id = ?::bigint)
              AND NOT EXISTS (
                  SELECT 1
                  FROM topic_matches m
                  JOIN posts p ON p.id = m.post_id
                  WHERE m.topic_id = h.topic_id
                    AND p.posted_at >= h.hour
                    AND p.posted_at < h.hour + interval '1 hour'
              )
            SQL, [$topicId, $topicId]);
    }
}
