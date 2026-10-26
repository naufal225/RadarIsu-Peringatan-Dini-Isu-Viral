<?php

namespace App\Services\Detection;

use App\Models\Topic;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Finds the similar-text pairs of each topic's window and hands them to CoordinationDetector (F4,
 * PRD §10.6). All I/O of the coordination detector lives here.
 *
 * Comparing every post with every other is quadratic (and a campaign of N similar posts is N^2 pairs),
 * so it is bounded four ways: similar posts are only looked for inside one topic and one window; a topic
 * with fewer distinct accounts than min_accounts_cluster cannot form a cluster and is skipped on a cheap
 * count; a window larger than coordination_max_posts keeps the newest posts and says so (`truncated`);
 * and only seed-to-member pairs are fetched, never member-to-member.
 *
 * The window's texts are copied into a temporary table with its own GIN trigram index, and each cluster
 * is grown from its seed with the `%` operator against the seed's text. A temporary table puts the
 * index choice under our control: against the big `posts` table the planner scanned by id and compared
 * every pair (30 s for 2000 posts). Measured on 2000 posts: a seed costs 1-31 ms. The exact PRD
 * comparison `similarity() >= similarity_threshold` is applied on top of `%`.
 */
class CoordinationDetectionService
{
    /**
     * @param  Collection<int, Topic>  $topics
     * @param  array<string, mixed>  $settings
     * @return array<int, array<string, mixed>> detector result per topic id, plus window facts
     */
    public function detect(Collection $topics, CarbonImmutable $now, array $settings): array
    {
        $from = $now->subMinutes((int) $settings['coordination_window_minutes']);
        $counts = $this->windowCounts($topics->pluck('id')->all(), $from, $now);
        $cap = (int) $settings['coordination_max_posts'];
        $results = [];

        foreach ($topics as $topic) {
            $count = $counts[$topic->id] ?? null;
            $posts = (int) ($count->posts ?? 0);
            $accounts = (int) ($count->accounts ?? 0);

            $result = CoordinationDetector::detect([], [], $settings);
            if ($accounts >= (int) $settings['min_accounts_cluster']) {
                $result = $this->cluster($topic->id, $from, $now, $cap, $settings);
                if ($posts > $cap) {
                    Log::warning('detection.coordination.truncated', [
                        'topic_id' => $topic->id, 'posts_in_window' => $posts, 'kept' => $cap,
                        'data_clock' => $now->toIso8601String(),
                    ]);
                }
            }

            $results[$topic->id] = $result + [
                'window' => ['from' => $from->toIso8601ZuluString(), 'to' => $now->toIso8601ZuluString()],
                'posts_in_window' => $posts,
                'accounts_in_window' => $accounts,
                'truncated' => $posts > $cap,
            ];
        }

        return $results;
    }

    /**
     * Writes `metrics_hourly.anomalous_accounts` (PRD §10.6 step 4): per hour, the distinct accounts that
     * posted in a coordinated cluster. It only ever rises (GREATEST), so a rerun or a narrower window
     * never erases what an earlier pass found; the aggregator never touches the column.
     *
     * @param  array<string, mixed>  $result
     */
    public function recordAnomalous(int $topicId, array $result): void
    {
        foreach ($result['anomalous_by_hour'] as $hour => $accounts) {
            DB::update(
                'UPDATE metrics_hourly SET anomalous_accounts = GREATEST(anomalous_accounts, ?), updated_at = ?::timestamptz
                 WHERE topic_id = ? AND hour = ?::timestamptz',
                [$accounts, now()->utc()->format('Y-m-d H:i:s.u').'+00', $topicId, $hour.'+00'],
            );
        }
    }

    /**
     * @param  list<int>  $topicIds
     * @return Collection<int, object{topic_id: int, posts: int, accounts: int}>
     */
    private function windowCounts(array $topicIds, CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        return DB::table('topic_matches as m')->join('posts as p', 'p.id', '=', 'm.post_id')
            ->whereIn('m.topic_id', $topicIds)->where('p.posted_at', '>', $from)->where('p.posted_at', '<=', $to)
            ->groupBy('m.topic_id')
            ->selectRaw('m.topic_id, count(*) as posts, count(DISTINCT p.account_id) as accounts')
            ->get()->keyBy('topic_id');
    }

    /**
     * @param  array<string, mixed>  $settings
     * @return array<string, mixed>
     */
    private function cluster(int $topicId, CarbonImmutable $from, CarbonImmutable $to, int $cap, array $settings): array
    {
        $rows = DB::table('topic_matches as m')->join('posts as p', 'p.id', '=', 'm.post_id')
            ->join('accounts as a', 'a.id', '=', 'p.account_id')
            ->where('m.topic_id', $topicId)->where('p.posted_at', '>', $from)->where('p.posted_at', '<=', $to)
            ->orderByDesc('p.posted_at')->orderByDesc('p.id')->limit($cap)
            ->get(['p.id', 'p.account_id', 'p.posted_at', 'p.text_norm', 'a.platform_created_at']);

        $posts = $rows->map(fn ($row) => [
            'id' => (int) $row->id,
            'account_id' => (int) $row->account_id,
            'posted_at' => CarbonImmutable::parse($row->posted_at)->getTimestamp(),
            'account_created_at' => $row->platform_created_at === null ? null : CarbonImmutable::parse($row->platform_created_at)->getTimestamp(),
        ])->all();

        $texts = $rows->pluck('text_norm', 'id')->all();
        $result = CoordinationDetector::detect(
            $posts,
            $this->seedPairs($posts, $texts, (float) $settings['similarity_threshold'], (int) $settings['min_accounts_cluster']),
            $settings,
        );

        $hours = [];
        $flagged = array_flip($result['flagged_post_ids']);
        foreach ($posts as $post) {
            if (isset($flagged[$post['id']])) {
                $hour = CarbonImmutable::createFromTimestampUTC($post['posted_at'])->startOfHour()->format('Y-m-d H:i:s');
                $hours[$hour][$post['account_id']] = true;
            }
        }
        $result['anomalous_by_hour'] = array_map('count', $hours);

        return $result;
    }

    /**
     * Seed-to-member pairs in the order CoordinationDetector grows clusters: the earliest post that is
     * still unassigned becomes a seed and takes every unassigned post similar to it. Stops as soon as the
     * unassigned posts hold fewer distinct accounts than a cluster needs.
     *
     * @param  list<array{id: int, account_id: int, posted_at: int}>  $posts
     * @param  array<int, string>  $texts  post id => text_norm
     * @return list<array{0: int, 1: int, 2: float}>
     */
    private function seedPairs(array $posts, array $texts, float $threshold, int $minAccounts): array
    {
        if (count($posts) < 2) {
            return [];
        }

        usort($posts, static fn ($a, $b) => [$a['posted_at'], $a['id']] <=> [$b['posted_at'], $b['id']]);
        $accountOf = array_column($posts, 'account_id', 'id');
        $remaining = array_fill_keys(array_keys($accountOf), true);
        $accountCounts = array_count_values($accountOf);

        return DB::transaction(function () use ($texts, $threshold, $minAccounts, $accountOf, &$remaining, &$accountCounts) {
            // The `%` operator reads this setting; `true` keeps it local to the transaction.
            DB::select("SELECT set_config('pg_trgm.similarity_threshold', ?, true)", [(string) $threshold]);
            DB::statement('CREATE TEMP TABLE coordination_window (id bigint PRIMARY KEY, text_norm text NOT NULL) ON COMMIT DROP');

            try {
                foreach (array_chunk(array_keys($remaining), 500) as $chunk) {
                    DB::insert(
                        'INSERT INTO coordination_window (id, text_norm) VALUES '.implode(',', array_fill(0, count($chunk), '(?, ?)')),
                        array_merge(...array_map(fn ($id) => [$id, $texts[$id]], $chunk)),
                    );
                }
                DB::statement('CREATE INDEX coordination_window_trgm ON coordination_window USING GIN (text_norm gin_trgm_ops)');
                DB::statement('ANALYZE coordination_window');
                // A few thousand rows: left alone the planner scans and compares every pair, so use the index.
                DB::statement('SET LOCAL enable_seqscan = off');

                $pairs = [];
                while (count($accountCounts) >= $minAccounts && $remaining !== []) {
                    $seed = array_key_first($remaining);
                    $members = DB::select(
                        'SELECT id, similarity(text_norm, ?) AS sim FROM coordination_window
                         WHERE id <> ? AND text_norm % ? AND similarity(text_norm, ?) >= ?::real',
                        [$texts[$seed], $seed, $texts[$seed], $texts[$seed], $threshold],
                    );

                    $assigned = [...array_map(fn ($m) => (int) $m->id, $members), $seed];
                    foreach ($assigned as $id) {
                        unset($remaining[$id]);
                        if (--$accountCounts[$accountOf[$id]] === 0) {
                            unset($accountCounts[$accountOf[$id]]);
                        }
                    }
                    DB::delete('DELETE FROM coordination_window WHERE id = ANY(?::bigint[])', ['{'.implode(',', $assigned).'}']);

                    foreach ($members as $member) {
                        $pairs[] = [$seed, (int) $member->id, (float) $member->sim];
                    }
                }

                return $pairs;
            } finally {
                DB::statement('SET LOCAL enable_seqscan = on');
                DB::statement('DROP TABLE IF EXISTS coordination_window');
            }
        });
    }
}
