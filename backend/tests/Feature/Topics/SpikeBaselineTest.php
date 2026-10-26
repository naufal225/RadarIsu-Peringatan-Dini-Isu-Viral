<?php

namespace Tests\Feature\Topics;

use App\Models\Alert;
use App\Models\Topic;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\BuildsDetectionData;
use Tests\TestCase;

/**
 * GET /topics/{topic}/spike-baseline (F3): the numbers behind the spike chart.
 */
class SpikeBaselineTest extends TestCase
{
    use BuildsDetectionData;
    use RefreshDatabase;

    protected bool $seed = true;

    private CarbonImmutable $clock;

    protected function setUp(): void
    {
        parent::setUp();
        $this->clock = CarbonImmutable::parse('2026-10-26 12:30:00', 'UTC');
        $this->travelTo($this->clock);
    }

    private function url(Topic $topic, string $query = ''): string
    {
        return "/api/v1/topics/{$topic->id}/spike-baseline{$query}";
    }

    private function topicWithHistory(): Topic
    {
        $topic = Topic::factory()->create(['sensitivity' => 'medium']);
        $this->addHourlyHistory($this->makeSource(), $topic, $this->makeAccounts(5), $this->clock->startOfHour(), 48, 10);
        $this->rebuildMetrics($topic);

        return $topic;
    }

    public function test_analyst_and_leader_read_the_baseline(): void
    {
        $topic = $this->topicWithHistory();

        foreach (['analyst', 'leader'] as $role) {
            $this->actingAsRole($role);
            $this->getJson($this->url($topic))
                ->assertOk()
                ->assertJsonPath('data.topic_id', $topic->id)
                ->assertJsonPath('data.as_of', '2026-10-26T12:30:00Z')
                ->assertJsonPath('data.spike.status', 'below_threshold')
                ->assertJsonPath('data.spike.has_sufficient_baseline', true)
                ->assertJsonPath('data.spike.baseline_hours', 48)
                ->assertJsonPath('data.spike.mean', 10)
                ->assertJsonPath('data.spike.z_effective', 3)
                ->assertJsonPath('data.spike.threshold_rate', 13);
            $this->resetAuth();
        }
    }

    public function test_series_is_zero_filled_and_ends_at_the_running_hour(): void
    {
        $topic = $this->topicWithHistory();
        $this->actingAsRole('analyst');

        $series = $this->getJson($this->url($topic, '?hours=6'))->assertOk()->json('data.series');

        $this->assertCount(6, $series);
        $this->assertSame('2026-10-26T07:00:00Z', $series[0]['hour']);
        $this->assertSame('2026-10-26T12:00:00Z', $series[5]['hour']);
        $this->assertSame(10, $series[0]['volume']);
        $this->assertSame(0, $series[5]['volume']);  // nothing yet in the running hour
        $this->assertTrue($series[5]['is_running_hour']);
        $this->assertFalse($series[4]['is_running_hour']);
    }

    public function test_default_is_72_hours(): void
    {
        $topic = $this->topicWithHistory();
        $this->actingAsRole('analyst');

        $this->getJson($this->url($topic))->assertOk()->assertJsonCount(72, 'data.series');
    }

    public function test_a_topic_without_history_reports_insufficient_baseline_not_an_error(): void
    {
        $topic = Topic::factory()->create();
        $this->actingAsRole('analyst');

        $this->getJson($this->url($topic))
            ->assertOk()
            ->assertJsonPath('data.spike.status', 'insufficient_baseline')
            ->assertJsonPath('data.spike.has_sufficient_baseline', false)
            ->assertJsonPath('data.spike.baseline_hours', 0);
    }

    public function test_it_does_not_expose_alerts(): void
    {
        $topic = $this->topicWithHistory();
        Alert::factory()->status('new')->create(['topic_id' => $topic->id]);
        $this->actingAsRole('leader'); // a leader may not see 'new' alerts

        $json = $this->getJson($this->url($topic))->assertOk()->json('data');

        $this->assertSame(['topic_id', 'as_of', 'spike', 'series'], array_keys($json));
    }

    public function test_admin_is_forbidden_and_guests_are_unauthorized(): void
    {
        $topic = $this->topicWithHistory();

        $this->getJson($this->url($topic))->assertUnauthorized();

        $this->actingAsRole('admin');
        $this->getJson($this->url($topic))->assertForbidden();
    }

    public function test_unknown_topic_is_not_found(): void
    {
        $this->actingAsRole('analyst');

        $this->getJson('/api/v1/topics/999999/spike-baseline')->assertNotFound();
    }

    /**
     * @return array<string, array{string}>
     */
    public static function invalidHours(): array
    {
        return [
            'too few' => ['?hours=5'],
            'too many' => ['?hours=169'],
            'not a number' => ['?hours=abc'],
            'fraction' => ['?hours=7.5'],
            'array' => ['?hours[]=6'],
        ];
    }

    #[DataProvider('invalidHours')]
    public function test_invalid_hours_are_rejected(string $query): void
    {
        $topic = $this->topicWithHistory();
        $this->actingAsRole('analyst');

        $this->getJson($this->url($topic, $query))->assertUnprocessable()->assertJsonValidationErrors(['hours']);
    }
}
