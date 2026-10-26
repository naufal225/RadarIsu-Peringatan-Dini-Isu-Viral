<?php

namespace App\Jobs;

use App\Models\RawItem;
use App\Models\Source;
use App\Services\Ingest\InvalidPayloadException;
use App\Services\Ingest\PostNormalizer;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * raw_items (processed_at IS NULL) → accounts + posts (PRD §10.1), then hands the new posts to MatchTopicsJob.
 *
 * Safe to run from several workers and from the scheduled sweep at once: each round claims its items
 * with FOR UPDATE SKIP LOCKED. Reprocessing is harmless, posts are unique per (source, external_id).
 */
class NormalizePostsJob implements ShouldQueue
{
    use Queueable;

    public const CHUNK = 500;

    /** Rounds per run; when items remain after that the job queues itself again, so no run grows unbounded. */
    public const MAX_ROUNDS = 20;

    /** PRD §13: failed jobs are retried 3 times, then listed in failed_jobs. */
    public int $tries = 3;

    public function __construct(public int $chunkSize = self::CHUNK) {}

    public function handle(PostNormalizer $normalizer): void
    {
        for ($round = 0; $round < self::MAX_ROUNDS; $round++) {
            $postIds = DB::transaction(fn () => $this->processChunk($normalizer));

            if ($postIds === null) {
                return;
            }
            if ($postIds !== []) {
                MatchTopicsJob::dispatch($postIds);
            }
        }

        self::dispatch($this->chunkSize);
    }

    /**
     * @return list<int>|null ids of the posts created from this round's items; null when nothing was left to process
     */
    private function processChunk(PostNormalizer $normalizer): ?array
    {
        $items = RawItem::query()
            ->whereNull('processed_at')
            ->orderBy('id')
            ->limit($this->chunkSize)
            ->lock('for update skip locked')
            ->get();

        if ($items->isEmpty()) {
            return null;
        }

        $sources = Source::whereIn('id', $items->pluck('source_id')->unique())->get()->keyBy('id');

        $accounts = [];
        $posts = [];
        foreach ($items as $item) {
            try {
                $normalized = $normalizer->normalize($sources[$item->source_id], $item->payload);
            } catch (InvalidPayloadException $e) {
                // Skipped, not retried forever: it would block every run behind it (docs/PIPELINE.md).
                Log::warning('Raw item skipped: invalid payload', ['raw_item_id' => $item->id, 'reason' => $e->getMessage()]);

                continue;
            }

            $account = $normalized['account'];
            $key = $account['source_type']."\0".$account['handle'];
            if (! isset($accounts[$key])) {
                $accounts[$key] = $account;
            } else {
                $accounts[$key]['first_seen_at'] = min($accounts[$key]['first_seen_at'], $account['first_seen_at']);
                $accounts[$key]['display_name'] ??= $account['display_name'];
                $accounts[$key]['platform_created_at'] ??= $account['platform_created_at'];
            }
            $posts[] = ['raw_item_id' => $item->id, 'account_key' => $key] + $normalized['post'];
        }

        $accountIds = $this->upsertAccounts(array_values($accounts));
        $this->insertPosts($posts, $accountIds);

        RawItem::whereIn('id', $items->pluck('id'))->update(['processed_at' => now()]);

        return DB::table('posts')->whereIn('raw_item_id', $items->pluck('id'))->pluck('id')->map(fn ($id) => (int) $id)->all();
    }

    /**
     * First value seen wins for display name and platform creation time; first_seen_at only moves back.
     *
     * @param  list<array<string, mixed>>  $accounts
     * @return array<string, int> account id per "source_type\0handle"
     */
    private function upsertAccounts(array $accounts): array
    {
        if ($accounts === []) {
            return [];
        }

        $now = now()->utc()->format('Y-m-d H:i:s.u').'+00';
        $format = fn ($time) => $time?->format('Y-m-d H:i:s.u').($time ? '+00' : '');

        $bindings = [];
        foreach ($accounts as $account) {
            array_push(
                $bindings,
                $account['source_type'],
                $account['handle'],
                $account['display_name'],
                $format($account['platform_created_at']) ?: null,
                $format($account['first_seen_at']),
                $now,
                $now,
            );
        }
        $values = implode(',', array_fill(0, count($accounts), '(?, ?, ?, ?::timestamptz, ?::timestamptz, ?::timestamptz, ?::timestamptz)'));

        DB::statement(<<<SQL
            INSERT INTO accounts (source_type, handle, display_name, platform_created_at, first_seen_at, created_at, updated_at)
            VALUES {$values}
            ON CONFLICT (source_type, handle) DO UPDATE SET
                first_seen_at = LEAST(accounts.first_seen_at, EXCLUDED.first_seen_at),
                display_name = COALESCE(accounts.display_name, EXCLUDED.display_name),
                platform_created_at = COALESCE(accounts.platform_created_at, EXCLUDED.platform_created_at),
                updated_at = EXCLUDED.updated_at
            SQL, $bindings);

        $ids = [];
        foreach (collect($accounts)->groupBy('source_type') as $type => $group) {
            $found = DB::table('accounts')
                ->where('source_type', $type)
                ->whereIn('handle', $group->pluck('handle'))
                ->pluck('id', 'handle');
            foreach ($group as $account) {
                $ids[$type."\0".$account['handle']] = (int) $found[$account['handle']];
            }
        }

        return $ids;
    }

    /**
     * @param  list<array<string, mixed>>  $posts
     * @param  array<string, int>  $accountIds
     */
    private function insertPosts(array $posts, array $accountIds): void
    {
        $now = now();
        $rows = array_map(fn (array $post) => [
            'source_id' => $post['source_id'],
            'raw_item_id' => $post['raw_item_id'],
            'account_id' => $accountIds[$post['account_key']],
            'external_id' => $post['external_id'],
            'text' => $post['text'],
            'text_norm' => $post['text_norm'],
            'posted_at' => $post['posted_at'],
            'sentiment' => $post['sentiment'],
            'sentiment_score' => $post['sentiment_score'],
            'is_simulated' => $post['is_simulated'],
            'label_manual' => $post['label_manual'],
            'created_at' => $now,
            'updated_at' => $now,
        ], $posts);

        // ON CONFLICT DO NOTHING: a repeated (source, external_id) is the same post.
        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('posts')->insertOrIgnore($chunk);
        }
    }
}
