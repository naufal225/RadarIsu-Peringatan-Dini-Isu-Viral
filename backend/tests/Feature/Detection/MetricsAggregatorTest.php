<?php

namespace Tests\Feature\Detection;

use App\Jobs\AggregateMetricsJob;
use App\Jobs\NormalizePostsJob;
use App\Models\Account;
use App\Models\MetricHourly;
use App\Models\Post;
use App\Models\Source;
use App\Models\Topic;
use App\Services\Detection\MetricsAggregator;
use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * PRD §9.4, §10.1: topic_matches → metrics_hourly.
 */
class MetricsAggregatorTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private Topic $topic;

    private MetricsAggregator $aggregator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->topic = Topic::factory()->create(['keywords' => ['hoaks']]);
        $this->aggregator = new MetricsAggregator;
    }

    private function matched(string $postedAt, string $sentiment = 'neutral', ?Account $account = null, ?Source $source = null, ?Topic $topic = null): Post
    {
        $post = Post::factory()->create(array_filter([
            'posted_at' => $postedAt,
            'sentiment' => $sentiment,
            'account_id' => $account?->id,
            'source_id' => $source?->id,
        ]));
        DB::table('topic_matches')->insert(['post_id' => $post->id, 'topic_id' => ($topic ?? $this->topic)->id]);

        return $post;
    }

    private function metric(string $hour, ?Topic $topic = null): ?MetricHourly
    {
        return MetricHourly::where('topic_id', ($topic ?? $this->topic)->id)->where('hour', $hour)->first();
    }

    public function test_counts_volume_sentiment_accounts_and_sources_per_hour(): void
    {
        $a = Account::factory()->create();
        $b = Account::factory()->create();
        $source1 = Source::factory()->create();
        $source2 = Source::factory()->create();
        $this->matched('2026-10-20T08:05:00Z', 'positive', $a, $source1);
        $this->matched('2026-10-20T08:20:00Z', 'negative', $a, $source1);
        $this->matched('2026-10-20T08:40:00Z', 'negative', $b, $source2);
        $this->matched('2026-10-20T08:50:00Z', 'neutral', $b, $source2);
        $this->matched('2026-10-20T09:10:00Z', 'positive', $a, $source1);

        $this->aggregator->rebuildTopic($this->topic->id);

        $eight = $this->metric('2026-10-20 08:00:00+00');
        $this->assertSame(4, $eight->volume);
        $this->assertSame(1, $eight->positive_count);
        $this->assertSame(2, $eight->negative_count);
        $this->assertSame(1, $eight->neutral_count);
        $this->assertSame(2, $eight->unique_accounts);
        $this->assertSame(2, $eight->source_count);
        $this->assertSame(0, $eight->anomalous_accounts);

        $nine = $this->metric('2026-10-20 09:00:00+00');
        $this->assertSame([1, 1, 0, 0, 1, 1], [$nine->volume, $nine->positive_count, $nine->negative_count, $nine->neutral_count, $nine->unique_accounts, $nine->source_count]);
        $this->assertSame(2, MetricHourly::count());
    }

    public function test_sentiment_counts_always_add_up_to_the_volume(): void
    {
        $this->matched('2026-10-20T08:05:00Z', 'positive');
        $this->matched('2026-10-20T08:06:00Z', 'negative');
        $this->matched('2026-10-20T08:07:00Z', 'neutral');
        $post = $this->matched('2026-10-20T08:08:00Z');
        DB::table('posts')->where('id', $post->id)->update(['sentiment' => null]);

        $this->aggregator->rebuildTopic($this->topic->id);

        $m = $this->metric('2026-10-20 08:00:00+00');
        $this->assertSame(4, $m->volume);
        $this->assertSame($m->volume, $m->positive_count + $m->negative_count + $m->neutral_count);
        $this->assertSame(2, $m->neutral_count);
    }

    public function test_hours_are_utc_and_split_exactly_on_the_hour(): void
    {
        $this->matched('2026-10-20T08:59:59Z');
        $this->matched('2026-10-20T09:00:00Z');
        // 16:30 at +07:00 is 09:30 UTC.
        $this->matched(CarbonImmutable::parse('2026-10-20T16:30:00+07:00')->utc()->toIso8601String());

        $this->aggregator->rebuildTopic($this->topic->id);

        $this->assertSame(1, $this->metric('2026-10-20 08:00:00+00')->volume);
        $this->assertSame(2, $this->metric('2026-10-20 09:00:00+00')->volume);
    }

    public function test_recompute_of_an_hour_ignores_posts_that_start_the_next_hour(): void
    {
        $this->matched('2026-10-20T08:59:59Z');
        $this->matched('2026-10-20T09:00:00Z');
        $this->matched('2026-10-20T09:30:00Z');

        $this->aggregator->recompute([[$this->topic->id, '2026-10-20 08:00:00']]);

        $this->assertSame(1, $this->metric('2026-10-20 08:00:00+00')->volume);
        $this->assertNull($this->metric('2026-10-20 09:00:00+00'), 'the next hour is not computed from a partial set of its posts');
    }

    public function test_a_post_is_counted_once_per_topic_it_matches(): void
    {
        $other = Topic::factory()->create(['keywords' => ['bansos']]);
        $post = $this->matched('2026-10-20T08:05:00Z');
        DB::table('topic_matches')->insert(['post_id' => $post->id, 'topic_id' => $other->id]);

        $this->aggregator->rebuildAll();

        $this->assertSame(1, $this->metric('2026-10-20 08:00:00+00')->volume);
        $this->assertSame(1, $this->metric('2026-10-20 08:00:00+00', $other)->volume);
    }

    public function test_recompute_updates_counts_but_never_the_detectors_anomalous_accounts(): void
    {
        $this->matched('2026-10-20T08:05:00Z');
        $this->aggregator->recompute([[$this->topic->id, '2026-10-20 08:00:00']]);
        $this->assertSame(0, $this->metric('2026-10-20 08:00:00+00')->anomalous_accounts);

        // CoordinationDetector (Phase 4) writes this column.
        MetricHourly::where('topic_id', $this->topic->id)->update(['anomalous_accounts' => 7]);
        $this->matched('2026-10-20T08:25:00Z', 'negative');
        $this->aggregator->recompute([[$this->topic->id, '2026-10-20 08:00:00']]);

        $m = $this->metric('2026-10-20 08:00:00+00');
        $this->assertSame(2, $m->volume);
        $this->assertSame(1, $m->negative_count);
        $this->assertSame(7, $m->anomalous_accounts);
    }

    public function test_recompute_only_touches_the_given_pairs(): void
    {
        $this->matched('2026-10-20T08:05:00Z');
        $this->matched('2026-10-20T09:05:00Z');
        $this->aggregator->rebuildTopic($this->topic->id);
        MetricHourly::where('hour', '2026-10-20 09:00:00+00')->update(['volume' => 99]);
        $this->matched('2026-10-20T08:35:00Z');

        $this->aggregator->recompute([[$this->topic->id, '2026-10-20 08:00:00']]);

        $this->assertSame(2, $this->metric('2026-10-20 08:00:00+00')->volume);
        $this->assertSame(99, $this->metric('2026-10-20 09:00:00+00')->volume, 'the other hour is left alone');
    }

    public function test_recompute_is_idempotent(): void
    {
        $this->matched('2026-10-20T08:05:00Z', 'positive');
        $pairs = [[$this->topic->id, '2026-10-20 08:00:00']];

        $this->aggregator->recompute($pairs);
        $this->aggregator->recompute($pairs);

        $this->assertSame(1, MetricHourly::count());
        $this->assertSame(1, $this->metric('2026-10-20 08:00:00+00')->volume);
    }

    public function test_recompute_since_covers_whole_hours_from_the_window_start(): void
    {
        $this->matched('2026-10-20T07:59:00Z');
        $this->matched('2026-10-20T08:05:00Z');
        $this->matched('2026-10-20T09:05:00Z');

        $this->aggregator->recomputeSince(CarbonImmutable::parse('2026-10-20T08:40:00Z'));

        $this->assertNull($this->metric('2026-10-20 07:00:00+00'));
        $this->assertSame(1, $this->metric('2026-10-20 08:00:00+00')->volume, 'the window starts at the hour, not at 08:40');
        $this->assertSame(1, $this->metric('2026-10-20 09:00:00+00')->volume);
    }

    public function test_recompute_since_can_be_limited_to_one_topic(): void
    {
        $other = Topic::factory()->create(['keywords' => ['bansos']]);
        $this->matched('2026-10-20T08:05:00Z');
        $this->matched('2026-10-20T08:06:00Z', topic: $other);

        $this->aggregator->recomputeSince(CarbonImmutable::parse('2026-10-20T00:00:00Z'), $other->id);

        $this->assertNull($this->metric('2026-10-20 08:00:00+00'));
        $this->assertSame(1, $this->metric('2026-10-20 08:00:00+00', $other)->volume);
    }

    public function test_rebuild_drops_hours_without_posts_but_keeps_the_rest_untouched(): void
    {
        $this->matched('2026-10-20T08:05:00Z');
        $this->aggregator->rebuildTopic($this->topic->id);
        MetricHourly::where('hour', '2026-10-20 08:00:00+00')->update(['anomalous_accounts' => 3]);
        MetricHourly::create(['topic_id' => $this->topic->id, 'hour' => '2026-10-20 05:00:00+00', 'volume' => 5]);
        $otherTopic = Topic::factory()->create();
        MetricHourly::create(['topic_id' => $otherTopic->id, 'hour' => '2026-10-20 05:00:00+00', 'volume' => 9]);

        $this->aggregator->rebuildTopic($this->topic->id);

        $this->assertNull($this->metric('2026-10-20 05:00:00+00'), 'stale hour removed');
        $this->assertSame(3, $this->metric('2026-10-20 08:00:00+00')->anomalous_accounts, 'kept hours keep the detector column');
        $this->assertSame(9, $this->metric('2026-10-20 05:00:00+00', $otherTopic)->volume, 'other topics untouched');
    }

    public function test_rebuild_all_covers_every_topic_and_drops_empty_hours(): void
    {
        $other = Topic::factory()->create(['keywords' => ['bansos']]);
        $this->matched('2026-10-20T08:05:00Z');
        $this->matched('2026-10-20T09:05:00Z', topic: $other);
        MetricHourly::create(['topic_id' => $other->id, 'hour' => '2026-10-19 05:00:00+00', 'volume' => 5]);

        $this->aggregator->rebuildAll();

        $this->assertSame(2, MetricHourly::count());
        $this->assertNotNull($this->metric('2026-10-20 08:00:00+00'));
        $this->assertNotNull($this->metric('2026-10-20 09:00:00+00', $other));
    }

    public function test_aggregate_job_recomputes_its_pairs(): void
    {
        $this->matched('2026-10-20T08:05:00Z');

        (new AggregateMetricsJob([[$this->topic->id, '2026-10-20 08:00:00']]))->handle($this->aggregator);

        $this->assertSame(1, $this->metric('2026-10-20 08:00:00+00')->volume);
    }

    public function test_command_recomputes_a_recent_window(): void
    {
        $this->matched(now()->subHours(2)->toIso8601String());
        $this->matched(now()->subHours(100)->toIso8601String());

        $this->artisan('radarisu:aggregate')->assertSuccessful();

        $this->assertSame(1, MetricHourly::count(), 'the default window is 48 hours');

        $this->artisan('radarisu:aggregate --hours=200')->assertSuccessful();
        $this->assertSame(2, MetricHourly::count());
    }

    public function test_command_all_and_topic_options(): void
    {
        $this->matched('2026-10-20T08:05:00Z');
        MetricHourly::create(['topic_id' => $this->topic->id, 'hour' => '2026-10-20 05:00:00+00', 'volume' => 5]);

        $this->artisan("radarisu:aggregate --all --topic={$this->topic->id}")->assertSuccessful();
        $this->assertSame(1, MetricHourly::count());

        $this->artisan('radarisu:aggregate --all')->assertSuccessful();
        $this->assertSame(1, MetricHourly::count());
    }

    public function test_command_rejects_bad_options(): void
    {
        $this->artisan('radarisu:aggregate --hours=0')->assertFailed();
        $this->artisan('radarisu:aggregate --hours=abc')->assertFailed();
        $this->artisan('radarisu:aggregate --topic=999999')->assertFailed();
    }

    public function test_pipeline_is_scheduled(): void
    {
        $events = collect(app(Schedule::class)->events());

        $aggregate = $events->first(fn ($e) => str_contains($e->command ?? '', 'radarisu:aggregate'));
        $this->assertNotNull($aggregate);
        $this->assertSame('*/5 * * * *', $aggregate->expression);
        $this->assertTrue($aggregate->withoutOverlapping);

        $sweep = $events->first(fn ($e) => str_contains($e->description ?? '', NormalizePostsJob::class));
        $this->assertNotNull($sweep);
        $this->assertSame('* * * * *', $sweep->expression);
        $this->assertTrue($sweep->withoutOverlapping);
    }
}
