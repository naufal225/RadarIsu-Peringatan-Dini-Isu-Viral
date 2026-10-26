<?php

namespace Tests\Feature\Topics;

use App\Models\Alert;
use App\Models\Topic;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\BuildsDetectionData;
use Tests\TestCase;

/**
 * GET /topics/{topic}/coordination (F4): the clusters the detector sees right now. Analysts only.
 */
class TopicCoordinationTest extends TestCase
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

    private function url(Topic $topic): string
    {
        return "/api/v1/topics/{$topic->id}/coordination";
    }

    private function topicWithCampaign(int $accounts = 6, ?CarbonImmutable $createdAt = null): Topic
    {
        $topic = Topic::factory()->create();
        $ids = $this->makeAccounts($accounts, 'camp', $createdAt ?? $this->clock->subYear());
        $this->addPosts($this->makeSource(), $topic, array_map(
            fn ($i, $id) => ['at' => $this->clock->subMinutes(8)->addSeconds($i * 20), 'account_id' => $id,
                'text' => 'waspada penipuan atas nama satuan kami segera pindahkan dana ke rekening resmi kode '.($i + 1)],
            array_keys($ids), $ids,
        ));
        $this->rebuildMetrics($topic);

        return $topic;
    }

    public function test_analyst_sees_the_clusters_with_handles_and_the_numbers_behind_them(): void
    {
        $topic = $this->topicWithCampaign(6, $this->clock->subDays(3));
        $this->actingAsRole('analyst');

        $response = $this->getJson($this->url($topic))
            ->assertOk()
            ->assertJsonPath('data.topic_id', $topic->id)
            ->assertJsonPath('data.as_of', '2026-10-26T12:30:00Z')
            ->assertJsonPath('data.triggered', true)
            ->assertJsonPath('data.truncated', false)
            ->assertJsonPath('data.accounts_in_window', 6)
            ->assertJsonPath('data.thresholds.min_accounts_cluster', 5)
            ->assertJsonCount(1, 'data.clusters')
            ->assertJsonPath('data.clusters.0.accounts_count', 6)
            ->assertJsonPath('data.clusters.0.synchronized.is_synchronized', true);

        $cluster = $response->json('data.clusters.0');
        $this->assertStringStartsWith('waspada penipuan', $cluster['sample_text']);
        $this->assertCount(6, $cluster['accounts']);
        $this->assertSame('@camp_1', $cluster['accounts'][0]['handle']);
        $this->assertTrue($cluster['accounts'][0]['young']);
        $this->assertEqualsWithDelta(3.0, $cluster['accounts'][0]['age_days'], 0.1);
        $this->assertGreaterThanOrEqual(0.8, $cluster['similarity_min']);
    }

    public function test_it_is_read_only(): void
    {
        $topic = $this->topicWithCampaign();
        $this->actingAsRole('analyst');

        $this->getJson($this->url($topic))->assertOk();

        $this->assertSame(0, Alert::count());
        $this->assertSame(0, DB::table('alert_evidence')->count());
        $this->assertSame(0, (int) DB::table('metrics_hourly')->where('topic_id', $topic->id)->sum('anomalous_accounts'));
    }

    public function test_a_quiet_topic_reports_not_triggered_with_no_clusters(): void
    {
        $topic = Topic::factory()->create();
        $this->actingAsRole('analyst');

        $this->getJson($this->url($topic))
            ->assertOk()
            ->assertJsonPath('data.triggered', false)
            ->assertJsonPath('data.posts_in_window', 0)
            ->assertJsonPath('data.clusters', []);
    }

    public function test_four_accounts_are_reported_as_not_triggered(): void
    {
        $topic = $this->topicWithCampaign(4);
        $this->actingAsRole('analyst');

        $this->getJson($this->url($topic))->assertOk()->assertJsonPath('data.triggered', false)->assertJsonPath('data.accounts_in_window', 4);
    }

    public function test_leader_and_admin_are_forbidden_and_guests_unauthorized(): void
    {
        $topic = $this->topicWithCampaign();

        $this->getJson($this->url($topic))->assertUnauthorized();

        foreach (['leader', 'admin'] as $role) {
            $this->actingAsRole($role);
            $this->getJson($this->url($topic))->assertForbidden();
            $this->resetAuth();
        }
    }

    public function test_unknown_topic_is_not_found(): void
    {
        $this->actingAsRole('analyst');

        $this->getJson('/api/v1/topics/999999/coordination')->assertNotFound();
    }
}
