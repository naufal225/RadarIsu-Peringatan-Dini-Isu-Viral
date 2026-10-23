<?php

namespace Tests\Feature\Topics;

use App\Models\MetricHourly;
use App\Models\Post;
use App\Models\Topic;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * PRD §11 GET /topics/{id}/metrics (F2): the hourly series behind a topic's chart.
 */
class TopicMetricsTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private Topic $topic;

    protected function setUp(): void
    {
        parent::setUp();
        $this->topic = Topic::factory()->create();
        $this->actingAsRole('analyst');
    }

    private function metric(string $hour, int $volume = 1, ?Topic $topic = null): MetricHourly
    {
        return MetricHourly::create([
            'topic_id' => ($topic ?? $this->topic)->id,
            'hour' => $hour,
            'volume' => $volume,
            'positive_count' => 1,
            'negative_count' => 0,
            'neutral_count' => $volume - 1,
            'unique_accounts' => 1,
            'anomalous_accounts' => 2,
            'source_count' => 1,
        ]);
    }

    /**
     * @return list<string>
     */
    private function hours(string $query = ''): array
    {
        return array_column($this->getJson("/api/v1/topics/{$this->topic->id}/metrics{$query}")->assertOk()->json('data'), 'hour');
    }

    public function test_returns_the_series_in_ascending_order_with_the_expected_fields(): void
    {
        $this->metric('2026-10-20 10:00:00+00', 3);
        $this->metric('2026-10-20 08:00:00+00', 5);

        $response = $this->getJson("/api/v1/topics/{$this->topic->id}/metrics?from=2026-10-20&to=2026-10-20")->assertOk();

        $this->assertSame(['2026-10-20T08:00:00Z', '2026-10-20T10:00:00Z'], array_column($response->json('data'), 'hour'));
        $this->assertSame(
            ['hour' => '2026-10-20T08:00:00Z', 'volume' => 5, 'positive_count' => 1, 'negative_count' => 0, 'neutral_count' => 4, 'unique_accounts' => 1, 'anomalous_accounts' => 2, 'source_count' => 1],
            $response->json('data.0'),
        );
        $response->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.from', '2026-10-20T00:00:00Z')
            ->assertJsonPath('meta.to', '2026-10-21T00:00:00Z');
    }

    public function test_only_the_requested_topic_is_returned(): void
    {
        $other = Topic::factory()->create();
        $this->metric('2026-10-20 08:00:00+00', 1);
        $this->metric('2026-10-20 08:00:00+00', 9, $other);

        $this->assertSame(['2026-10-20T08:00:00Z'], $this->hours('?from=2026-10-20&to=2026-10-20'));
        $this->assertSame(1, $this->getJson("/api/v1/topics/{$this->topic->id}/metrics?from=2026-10-20&to=2026-10-20")->json('data.0.volume'));
    }

    public function test_to_covers_its_whole_day_and_from_starts_at_midnight_utc(): void
    {
        $this->metric('2026-10-19 23:00:00+00');
        $this->metric('2026-10-20 00:00:00+00');
        $this->metric('2026-10-20 23:00:00+00');
        $this->metric('2026-10-21 00:00:00+00');

        $this->assertSame(
            ['2026-10-20T00:00:00Z', '2026-10-20T23:00:00Z'],
            $this->hours('?from=2026-10-20&to=2026-10-20'),
        );
    }

    public function test_default_range_is_seven_days_ending_on_the_latest_metric_day(): void
    {
        $this->metric('2026-10-01 08:00:00+00');   // too old for the default window
        $this->metric('2026-10-14 08:00:00+00');   // first day of the window
        $this->metric('2026-10-13 23:00:00+00');   // just before it
        $this->metric('2026-10-20 15:00:00+00');   // latest

        $response = $this->getJson("/api/v1/topics/{$this->topic->id}/metrics")->assertOk();

        $this->assertSame(['2026-10-14T08:00:00Z', '2026-10-20T15:00:00Z'], array_column($response->json('data'), 'hour'));
        $response->assertJsonPath('meta.from', '2026-10-14T00:00:00Z')->assertJsonPath('meta.to', '2026-10-21T00:00:00Z');
    }

    public function test_a_topic_without_metrics_returns_an_empty_series(): void
    {
        $this->getJson("/api/v1/topics/{$this->topic->id}/metrics")
            ->assertOk()
            ->assertJsonPath('data', [])
            ->assertJsonPath('meta.total', 0)
            ->assertJsonPath('meta.has_simulated_data', false);
    }

    public function test_only_from_or_only_to_is_accepted(): void
    {
        $this->metric('2026-10-18 08:00:00+00');
        $this->metric('2026-10-20 08:00:00+00');

        $this->assertSame(['2026-10-20T08:00:00Z'], $this->hours('?from=2026-10-19'));
        $this->assertSame(['2026-10-18T08:00:00Z'], $this->hours('?to=2026-10-18'));
    }

    public function test_a_range_of_up_to_31_days_is_allowed_and_longer_is_not(): void
    {
        $this->getJson("/api/v1/topics/{$this->topic->id}/metrics?from=2026-10-01&to=2026-10-31")->assertOk();

        $this->getJson("/api/v1/topics/{$this->topic->id}/metrics?from=2026-10-01&to=2026-11-01")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['from']);
    }

    public function test_bad_dates_are_rejected(): void
    {
        $url = "/api/v1/topics/{$this->topic->id}/metrics";

        $this->getJson("$url?from=20-10-2026")->assertUnprocessable()->assertJsonValidationErrors(['from']);
        $this->getJson("$url?to=besok")->assertUnprocessable()->assertJsonValidationErrors(['to']);
        $this->getJson("$url?from=2026-10-20&to=2026-10-19")->assertUnprocessable()->assertJsonValidationErrors(['to']);
    }

    public function test_flags_simulated_data_inside_the_range_only(): void
    {
        $inRange = Post::factory()->create(['posted_at' => '2026-10-20T08:10:00Z', 'is_simulated' => true]);
        $outside = Post::factory()->create(['posted_at' => '2026-10-10T08:10:00Z', 'is_simulated' => true]);
        $real = Post::factory()->create(['posted_at' => '2026-10-21T08:10:00Z', 'is_simulated' => false]);
        $otherTopic = Topic::factory()->create();
        foreach ([$inRange, $outside, $real] as $post) {
            DB::table('topic_matches')->insert(['post_id' => $post->id, 'topic_id' => $this->topic->id]);
        }
        $unrelated = Post::factory()->create(['posted_at' => '2026-10-21T09:10:00Z', 'is_simulated' => true]);
        DB::table('topic_matches')->insert(['post_id' => $unrelated->id, 'topic_id' => $otherTopic->id]);

        $url = "/api/v1/topics/{$this->topic->id}/metrics";
        $this->getJson("$url?from=2026-10-20&to=2026-10-20")->assertJsonPath('meta.has_simulated_data', true);
        $this->getJson("$url?from=2026-10-21&to=2026-10-21")->assertJsonPath('meta.has_simulated_data', false);
        $this->getJson("$url?from=2026-10-01&to=2026-10-05")->assertJsonPath('meta.has_simulated_data', false);
    }

    public function test_leader_can_read_the_series_and_admin_cannot(): void
    {
        $this->metric('2026-10-20 08:00:00+00');
        $url = "/api/v1/topics/{$this->topic->id}/metrics";

        $this->resetAuth();
        $this->actingAsRole('leader');
        $this->getJson($url)->assertOk()->assertJsonPath('meta.total', 1);

        $this->resetAuth();
        $this->actingAsRole('admin');
        $this->getJson($url)->assertForbidden();
    }

    public function test_unknown_topic_is_not_found(): void
    {
        $this->getJson('/api/v1/topics/999999/metrics')->assertNotFound();
    }
}
