<?php

namespace Tests\Feature\Detection;

use App\Jobs\AggregateMetricsJob;
use App\Jobs\MatchTopicsJob;
use App\Models\MetricHourly;
use App\Models\Post;
use App\Models\Topic;
use App\Services\Detection\MetricsAggregator;
use App\Services\Detection\TopicMatcher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * PRD §10.1: posts → topic_matches, and the follow-up to metrics_hourly.
 */
class MatchTopicsJobTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    private function makePost(string $textNorm, string $postedAt = '2026-10-20T08:30:00Z', string $sentiment = 'neutral'): Post
    {
        return Post::factory()->create(['text_norm' => $textNorm, 'posted_at' => $postedAt, 'sentiment' => $sentiment]);
    }

    private function handle(MatchTopicsJob $job): void
    {
        $job->handle(new TopicMatcher, new MetricsAggregator);
    }

    /**
     * @return list<int>
     */
    private function matchedPosts(Topic $topic): array
    {
        return DB::table('topic_matches')->where('topic_id', $topic->id)->orderBy('post_id')->pluck('post_id')->map(fn ($id) => (int) $id)->all();
    }

    public function test_matches_posts_to_active_topics_only(): void
    {
        $active = Topic::factory()->create(['keywords' => ['hoaks'], 'is_active' => true]);
        $inactive = Topic::factory()->create(['keywords' => ['hoaks'], 'is_active' => false]);
        $match = $this->makePost('ada hoaks beredar');
        $miss = $this->makePost('cuaca cerah');

        $this->handle(new MatchTopicsJob([$match->id, $miss->id]));

        $this->assertSame([$match->id], $this->matchedPosts($active));
        $this->assertSame([], $this->matchedPosts($inactive));
    }

    public function test_only_the_given_posts_are_matched(): void
    {
        $topic = Topic::factory()->create(['keywords' => ['hoaks']]);
        $given = $this->makePost('hoaks satu');
        $this->makePost('hoaks dua');

        $this->handle(new MatchTopicsJob([$given->id]));

        $this->assertSame([$given->id], $this->matchedPosts($topic));
    }

    public function test_running_twice_does_not_duplicate_matches(): void
    {
        $topic = Topic::factory()->create(['keywords' => ['hoaks']]);
        $post = $this->makePost('hoaks');

        $this->handle(new MatchTopicsJob([$post->id]));
        $this->handle(new MatchTopicsJob([$post->id]));

        $this->assertSame([$post->id], $this->matchedPosts($topic));
    }

    public function test_queues_the_affected_topic_hour_pairs_once_each(): void
    {
        $a = Topic::factory()->create(['keywords' => ['hoaks']]);
        $b = Topic::factory()->create(['keywords' => ['hoaks', 'bansos']]);
        $first = $this->makePost('hoaks pagi', '2026-10-20T08:05:00Z');
        $second = $this->makePost('hoaks juga pagi', '2026-10-20T08:55:00Z');
        $third = $this->makePost('bansos siang', '2026-10-20T09:00:00Z');

        $this->handle(new MatchTopicsJob([$first->id, $second->id, $third->id]));

        Queue::assertPushed(AggregateMetricsJob::class, function (AggregateMetricsJob $job) use ($a, $b) {
            $pairs = $job->pairs;
            sort($pairs);

            return $pairs === [
                [$a->id, '2026-10-20 08:00:00'],
                [$b->id, '2026-10-20 08:00:00'],
                [$b->id, '2026-10-20 09:00:00'],
            ];
        });
    }

    public function test_queues_nothing_when_nothing_matches(): void
    {
        Topic::factory()->create(['keywords' => ['hoaks']]);
        $post = $this->makePost('cuaca cerah');

        $this->handle(new MatchTopicsJob([$post->id]));

        Queue::assertNothingPushed();
        $this->assertSame(0, DB::table('topic_matches')->count());
    }

    public function test_topic_mode_matches_every_stored_post_and_builds_the_metrics(): void
    {
        $this->makePost('hoaks lama', '2026-10-01T08:00:00Z', 'negative');
        $this->makePost('hoaks baru', '2026-10-20T08:10:00Z', 'positive');
        $this->makePost('cuaca cerah');
        $topic = Topic::factory()->create(['keywords' => ['hoaks']]);

        $this->handle(MatchTopicsJob::forTopic($topic));

        $this->assertCount(2, $this->matchedPosts($topic));
        $this->assertSame(
            ['2026-10-01T08:00:00+00:00', '2026-10-20T08:00:00+00:00'],
            MetricHourly::where('topic_id', $topic->id)->orderBy('hour')->get()->map(fn ($m) => $m->hour->utc()->toIso8601String())->all(),
        );
        $this->assertSame(1, MetricHourly::where('topic_id', $topic->id)->where('negative_count', 1)->count());
    }

    public function test_changed_keywords_replace_the_old_matches_and_drop_stale_hours(): void
    {
        $old = $this->makePost('hoaks', '2026-10-20T08:00:00Z');
        $new = $this->makePost('bansos', '2026-10-20T10:00:00Z');
        $topic = Topic::factory()->create(['keywords' => ['hoaks']]);
        $this->handle(MatchTopicsJob::forTopic($topic));
        $this->assertSame([$old->id], $this->matchedPosts($topic));

        $topic->update(['keywords' => ['bansos']]);
        $this->handle(MatchTopicsJob::forTopic($topic));

        $this->assertSame([$new->id], $this->matchedPosts($topic));
        $this->assertSame(
            ['2026-10-20T10:00:00+00:00'],
            MetricHourly::where('topic_id', $topic->id)->get()->map(fn ($m) => $m->hour->utc()->toIso8601String())->all(),
        );
    }

    public function test_topic_mode_leaves_an_inactive_topic_and_its_history_alone(): void
    {
        $post = $this->makePost('hoaks');
        $topic = Topic::factory()->create(['keywords' => ['hoaks']]);
        $this->handle(MatchTopicsJob::forTopic($topic));

        $topic->update(['is_active' => false, 'keywords' => ['bansos']]);
        $this->handle(MatchTopicsJob::forTopic($topic));

        $this->assertSame([$post->id], $this->matchedPosts($topic));
        $this->assertSame(1, MetricHourly::where('topic_id', $topic->id)->count());
    }

    public function test_topic_mode_ignores_a_topic_that_no_longer_exists(): void
    {
        $this->handle(new MatchTopicsJob([], 999_999));

        $this->assertSame(0, DB::table('topic_matches')->count());
    }

    public function test_job_is_retried_three_times(): void
    {
        $this->assertSame(3, (new MatchTopicsJob)->tries);
        $this->assertSame(3, (new AggregateMetricsJob([]))->tries);
    }
}
