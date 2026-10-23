<?php

namespace Tests\Feature\Ingest;

use App\Jobs\MatchTopicsJob;
use App\Jobs\NormalizePostsJob;
use App\Models\Account;
use App\Models\Post;
use App\Models\RawItem;
use App\Models\Source;
use App\Services\Detection\SentimentAnalyzer;
use App\Services\Ingest\PostNormalizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * PRD §10.1, §10.4: raw_items → accounts + posts.
 */
class NormalizePostsJobTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private Source $source;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        $this->source = Source::factory()->create(['type' => 'csv']);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function rawItem(array $payload, ?Source $source = null): RawItem
    {
        $json = json_encode($payload);

        return RawItem::create([
            'source_id' => ($source ?? $this->source)->id,
            'external_id' => $payload['external_id'] ?? null,
            'payload' => $payload,
            'content_hash' => hash('sha256', $json.uniqid()),
            'fetched_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return $overrides + [
            'text' => 'Pelayanan buruk dan mengecewakan! https://contoh.id @humas',
            'account_handle' => '@akun_a',
            'posted_at' => '2026-10-20T08:15:00+07:00',
            'external_id' => null,
            'account_display_name' => null,
            'account_created_at' => null,
        ];
    }

    private function normalize(int $chunk = NormalizePostsJob::CHUNK): void
    {
        (new NormalizePostsJob($chunk))->handle(new PostNormalizer);
    }

    public function test_creates_account_and_post_with_normalized_text_and_sentiment(): void
    {
        $item = $this->rawItem($this->payload([
            'external_id' => 'e-1',
            'account_display_name' => 'Akun A',
            'account_created_at' => '2026-09-01T00:00:00Z',
        ]));

        $this->normalize();

        $post = Post::sole();
        $this->assertSame($item->id, $post->raw_item_id);
        $this->assertSame($this->source->id, $post->source_id);
        $this->assertSame('e-1', $post->external_id);
        $this->assertSame('Pelayanan buruk dan mengecewakan! https://contoh.id @humas', $post->text);
        $this->assertSame('pelayanan buruk dan mengecewakan', $post->text_norm);
        // Stored exactly as SentimentAnalyzer reports it for the raw text.
        $expected = SentimentAnalyzer::classify('Pelayanan buruk dan mengecewakan! https://contoh.id @humas');
        $this->assertSame('negative', $post->sentiment);
        $this->assertSame($expected['label'], $post->sentiment);
        $this->assertEqualsWithDelta($expected['score'], (float) $post->sentiment_score, 0.0005);
        $this->assertFalse($post->is_simulated);
        // 08:15 at +07:00 is 01:15 UTC (PRD §9.0: timestamptz, session in UTC).
        $this->assertSame('2026-10-20T01:15:00+00:00', $post->posted_at->utc()->toIso8601String());

        $account = Account::sole();
        $this->assertSame($account->id, $post->account_id);
        $this->assertSame('csv', $account->source_type);
        $this->assertSame('@akun_a', $account->handle);
        $this->assertSame('Akun A', $account->display_name);
        $this->assertSame('2026-09-01T00:00:00+00:00', $account->platform_created_at->utc()->toIso8601String());
        $this->assertSame('2026-10-20T01:15:00+00:00', $account->first_seen_at->utc()->toIso8601String());
    }

    public function test_sentiment_labels_follow_the_lexicon(): void
    {
        $this->rawItem($this->payload(['text' => 'Pelayanan bagus', 'account_handle' => '@b']));
        $this->rawItem($this->payload(['text' => 'Hari ini ada kegiatan', 'account_handle' => '@c']));

        $this->normalize();

        $this->assertSame('positive', Post::where('text', 'Pelayanan bagus')->value('sentiment'));
        $this->assertSame('neutral', Post::where('text', 'Hari ini ada kegiatan')->value('sentiment'));
        $this->assertSame(
            SentimentAnalyzer::classify('Pelayanan bagus')['label'],
            Post::where('text', 'Pelayanan bagus')->value('sentiment'),
        );
    }

    public function test_marks_items_processed_and_hands_the_new_posts_to_matching(): void
    {
        $this->rawItem($this->payload(['account_handle' => '@a']));
        $this->rawItem($this->payload(['account_handle' => '@b']));

        $this->normalize();

        $this->assertSame(0, RawItem::whereNull('processed_at')->count());
        Queue::assertPushed(MatchTopicsJob::class, fn (MatchTopicsJob $job) => $job->postIds === Post::orderBy('id')->pluck('id')->all() && $job->topicId === null);
    }

    public function test_posts_from_a_simulated_source_are_flagged(): void
    {
        $replay = Source::factory()->create(['type' => 'replay', 'is_simulated' => true]);
        $this->rawItem($this->payload(), $replay);

        $this->normalize();

        $this->assertTrue(Post::sole()->is_simulated);
        $this->assertSame('replay', Account::sole()->source_type);
    }

    public function test_the_same_handle_in_different_source_types_is_a_different_account(): void
    {
        $replay = Source::factory()->create(['type' => 'replay', 'is_simulated' => true]);
        $this->rawItem($this->payload(['external_id' => 'x']));
        $this->rawItem($this->payload(['external_id' => 'y']), $replay);

        $this->normalize();

        $this->assertSame(2, Account::where('handle', '@akun_a')->count());
    }

    public function test_repeated_handle_in_one_round_keeps_earliest_time_and_first_known_details(): void
    {
        $this->rawItem($this->payload(['posted_at' => '2026-10-20T10:00:00Z', 'external_id' => '1']));
        $this->rawItem($this->payload(['posted_at' => '2026-10-20T09:00:00Z', 'external_id' => '2', 'account_display_name' => 'Nama Pertama', 'account_created_at' => '2026-01-01T00:00:00Z']));
        $this->rawItem($this->payload(['posted_at' => '2026-10-20T11:00:00Z', 'external_id' => '3', 'account_display_name' => 'Nama Kedua']));

        $this->normalize();

        $account = Account::sole();
        $this->assertSame(3, $account->posts()->count());
        $this->assertSame('2026-10-20T09:00:00+00:00', $account->first_seen_at->utc()->toIso8601String());
        $this->assertSame('Nama Pertama', $account->display_name);
        $this->assertSame('2026-01-01T00:00:00+00:00', $account->platform_created_at->utc()->toIso8601String());
    }

    public function test_existing_account_keeps_its_details_and_first_seen_only_moves_back(): void
    {
        $this->rawItem($this->payload(['posted_at' => '2026-10-20T10:00:00Z', 'external_id' => '1', 'account_display_name' => 'Nama Lama']));
        $this->normalize();

        $this->rawItem($this->payload(['posted_at' => '2026-10-20T12:00:00Z', 'external_id' => '2', 'account_display_name' => 'Nama Baru']));
        $this->normalize();
        $this->assertSame('2026-10-20T10:00:00+00:00', Account::sole()->first_seen_at->utc()->toIso8601String());
        $this->assertSame('Nama Lama', Account::sole()->display_name);

        $this->rawItem($this->payload(['posted_at' => '2026-10-19T08:00:00Z', 'external_id' => '3']));
        $this->normalize();
        $this->assertSame('2026-10-19T08:00:00+00:00', Account::sole()->first_seen_at->utc()->toIso8601String());
        $this->assertSame(3, Post::count());
    }

    public function test_duplicate_external_id_in_a_source_is_one_post(): void
    {
        $first = $this->rawItem($this->payload(['external_id' => 'dup', 'text' => 'Versi pertama']));
        $second = $this->rawItem($this->payload(['external_id' => 'dup', 'text' => 'Versi kedua']));

        $this->normalize();

        $post = Post::sole();
        $this->assertSame($first->id, $post->raw_item_id);
        $this->assertNotNull($second->fresh()->processed_at);
        Queue::assertPushed(MatchTopicsJob::class, fn (MatchTopicsJob $job) => $job->postIds === [$post->id]);
    }

    public function test_running_again_does_not_duplicate_or_requeue(): void
    {
        $this->rawItem($this->payload());

        $this->normalize();
        $this->normalize();

        $this->assertSame(1, Post::count());
        Queue::assertPushed(MatchTopicsJob::class, 1);
    }

    public function test_items_already_processed_are_left_alone(): void
    {
        $item = $this->rawItem($this->payload());
        $item->forceFill(['processed_at' => now()->subDay()])->save();

        $this->normalize();

        $this->assertSame(0, Post::count());
        Queue::assertNothingPushed();
    }

    public function test_invalid_payload_is_skipped_without_blocking_the_rest(): void
    {
        $broken = $this->rawItem(['text' => 'tanpa akun', 'posted_at' => '2026-10-20T10:00:00Z']);
        $badDate = $this->rawItem($this->payload(['posted_at' => 'kemarin sore']));
        $good = $this->rawItem($this->payload(['account_handle' => '@ok']));

        $this->normalize();

        $this->assertSame([$good->id], Post::pluck('raw_item_id')->all());
        $this->assertNotNull($broken->fresh()->processed_at);
        $this->assertNotNull($badDate->fresh()->processed_at);
        $this->assertSame(0, RawItem::whereNull('processed_at')->count());
    }

    public function test_works_through_the_backlog_in_chunks(): void
    {
        foreach (range(1, 5) as $i) {
            $this->rawItem($this->payload(['account_handle' => "@akun_$i", 'external_id' => "e-$i"]));
        }

        $this->normalize(chunk: 2);

        $this->assertSame(5, Post::count());
        Queue::assertPushed(MatchTopicsJob::class, 3); // 2 + 2 + 1
        Queue::assertNotPushed(NormalizePostsJob::class);
    }

    public function test_a_long_backlog_requeues_itself_instead_of_running_unbounded(): void
    {
        foreach (range(1, NormalizePostsJob::MAX_ROUNDS + 2) as $i) {
            $this->rawItem($this->payload(['account_handle' => "@akun_$i", 'external_id' => "e-$i"]));
        }

        $this->normalize(chunk: 1);

        $this->assertSame(NormalizePostsJob::MAX_ROUNDS, Post::count());
        $this->assertSame(2, RawItem::whereNull('processed_at')->count());
        Queue::assertPushed(NormalizePostsJob::class, 1);
    }

    public function test_job_is_retried_three_times(): void
    {
        $this->assertSame(3, (new NormalizePostsJob)->tries);
    }
}
