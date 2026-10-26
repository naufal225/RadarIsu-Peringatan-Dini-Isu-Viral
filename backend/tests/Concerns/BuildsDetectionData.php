<?php

namespace Tests\Concerns;

use App\Models\Source;
use App\Models\Topic;
use App\Services\Detection\MetricsAggregator;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Bulk fixtures for the detectors. Factories create a source and an account per post, which is far
 * too slow for a 168-hour baseline, so these insert in chunks.
 */
trait BuildsDetectionData
{
    private int $postSequence = 0;

    protected function makeSource(array $attributes = []): Source
    {
        return Source::factory()->create($attributes);
    }

    /**
     * @return list<int> account ids
     */
    protected function makeAccounts(int $count, string $prefix = 'acct', ?CarbonInterface $firstSeen = null): array
    {
        $now = now()->utc()->format('Y-m-d H:i:s').'+00';
        $seen = ($firstSeen ?? now()->subYear())->copy()->utc()->format('Y-m-d H:i:s').'+00';
        $rows = [];
        for ($i = 1; $i <= $count; $i++) {
            $rows[] = [
                'source_type' => 'csv', 'handle' => "@{$prefix}_{$i}", 'display_name' => "{$prefix} {$i}",
                'platform_created_at' => $seen, 'first_seen_at' => $seen, 'created_at' => $now, 'updated_at' => $now,
            ];
        }
        DB::table('accounts')->insertOrIgnore($rows);

        return DB::table('accounts')->whereIn('handle', array_column($rows, 'handle'))->orderBy('id')->pluck('id')->all();
    }

    /**
     * @param  list<array{at: string|CarbonInterface, account_id: int, sentiment?: string|null, text?: string}>  $posts
     * @return list<int> post ids, in the order given
     */
    protected function addPosts(Source $source, Topic $topic, array $posts): array
    {
        $now = now()->utc()->format('Y-m-d H:i:s').'+00';
        $ids = [];

        foreach (array_chunk($posts, 500) as $chunk) {
            $rows = [];
            $keys = [];
            foreach ($chunk as $post) {
                $key = 'fx-'.(++$this->postSequence);
                $keys[] = $key;
                $text = $post['text'] ?? 'post '.$key;
                $rows[] = [
                    'source_id' => $source->id, 'account_id' => $post['account_id'], 'external_id' => $key,
                    'text' => $text, 'text_norm' => mb_strtolower($text),
                    'posted_at' => ($post['at'] instanceof CarbonInterface ? $post['at']->copy()->utc()->format('Y-m-d H:i:s') : $post['at']).'+00',
                    'sentiment' => $post['sentiment'] ?? null, 'is_simulated' => false,
                    'created_at' => $now, 'updated_at' => $now,
                ];
            }
            DB::table('posts')->insert($rows);
            $byKey = DB::table('posts')->where('source_id', $source->id)->whereIn('external_id', $keys)->pluck('id', 'external_id');
            foreach ($keys as $key) {
                $ids[] = $byKey[$key];
            }
        }

        DB::table('topic_matches')->insertOrIgnore(array_map(fn ($id) => ['post_id' => $id, 'topic_id' => $topic->id], $ids));

        return $ids;
    }

    /**
     * $perHour posts in each of the `$hours` hours that end at `$before` (exclusive, on the hour).
     *
     * @param  list<int>  $accountIds
     */
    protected function addHourlyHistory(Source $source, Topic $topic, array $accountIds, CarbonInterface $before, int $hours, int $perHour): void
    {
        $posts = [];
        for ($h = $hours; $h >= 1; $h--) {
            $start = $before->copy()->utc()->subHours($h);
            for ($i = 0; $i < $perHour; $i++) {
                $posts[] = ['at' => $start->copy()->addMinutes(($i * 59) % 60), 'account_id' => $accountIds[$i % count($accountIds)]];
            }
        }
        $this->addPosts($source, $topic, $posts);
    }

    protected function rebuildMetrics(Topic $topic): void
    {
        app(MetricsAggregator::class)->rebuildTopic($topic->id);
    }
}
