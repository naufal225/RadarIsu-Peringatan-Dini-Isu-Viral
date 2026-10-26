<?php

namespace Tests\Feature\Dashboard;

use App\Models\Account;
use App\Models\Alert;
use App\Models\Post;
use App\Models\Source;
use App\Models\Topic;
use App\Models\User;
use App\Services\Detection\DataClock;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->getJson('/api/v1/dashboard/summary')->assertUnauthorized();
        $this->getJson('/api/v1/dashboard/issues')->assertUnauthorized();
    }

    public function test_admin_is_forbidden(): void
    {
        $this->actingAsRole('admin');

        $this->getJson('/api/v1/dashboard/summary')->assertForbidden();
        $this->getJson('/api/v1/dashboard/issues')->assertForbidden();
    }

    public function test_analyst_sees_all_open_alerts_and_summary(): void
    {
        $this->actingAsRole('analyst');

        $topic = Topic::factory()->create(['name' => 'Isu Nasional']);

        // Open alerts (4 total, each with distinct topic due to unique partial index)
        Alert::factory()->status('new')->create(['severity' => 'low', 'score' => 30]);
        Alert::factory()->status('reviewing')->create(['severity' => 'medium', 'score' => 50]);
        Alert::factory()->status('escalated')->create(['severity' => 'high', 'score' => 85]);
        Alert::factory()->status('returned')->create(['severity' => 'medium', 'score' => 60]);

        // Terminal alert (closed, not active)
        Alert::factory()->status('closed')->create(['severity' => 'high', 'score' => 90]);

        $response = $this->getJson('/api/v1/dashboard/summary')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'active_issues',
                    'highest_severity',
                    'awaiting_decision',
                    'trend_24h' => [
                        '*' => ['hour', 'volume'],
                    ],
                    'data_notice' => ['has_simulated_data'],
                ],
            ]);

        $data = $response->json('data');
        $this->assertSame(4, $data['active_issues']); // new, reviewing, escalated, returned
        $this->assertSame('high', $data['highest_severity']);
        $this->assertSame(1, $data['awaiting_decision']); // escalated
        $this->assertCount(24, $data['trend_24h']);
    }

    public function test_leader_sees_scoped_active_issues(): void
    {
        $this->actingAsRole('leader');

        // Alerts hidden from leader
        Alert::factory()->status('new')->create(['severity' => 'high', 'score' => 90]);
        Alert::factory()->status('reviewing')->create(['severity' => 'high', 'score' => 80]);

        // Alerts visible to leader
        Alert::factory()->status('escalated')->create(['severity' => 'medium', 'score' => 60]);
        Alert::factory()->status('returned')->create(['severity' => 'low', 'score' => 35]);
        Alert::factory()->status('approved')->create(['severity' => 'high', 'score' => 95]); // terminal

        $response = $this->getJson('/api/v1/dashboard/summary')
            ->assertOk();

        $data = $response->json('data');
        // Leader active issues: escalated & returned (approved is terminal)
        $this->assertSame(2, $data['active_issues']);
        $this->assertSame('medium', $data['highest_severity']);
        $this->assertSame(1, $data['awaiting_decision']); // escalated
    }

    public function test_highest_severity_resolves_null_when_no_active_issues(): void
    {
        $this->actingAsRole('analyst');

        // Only closed alert
        Alert::factory()->status('closed')->create(['severity' => 'high']);

        $response = $this->getJson('/api/v1/dashboard/summary')->assertOk();
        $this->assertSame(0, $response->json('data.active_issues'));
        $this->assertNull($response->json('data.highest_severity'));
    }

    public function test_trend_24h_aggregates_hourly_posts_correctly(): void
    {
        $this->actingAsRole('analyst');

        $now = DataClock::now();
        $source = Source::factory()->create();
        $account = Account::factory()->create();

        // Insert posts at specific hours within last 24h
        Post::factory()->create([
            'source_id' => $source->id,
            'account_id' => $account->id,
            'posted_at' => $now->subHours(2),
        ]);
        Post::factory()->create([
            'source_id' => $source->id,
            'account_id' => $account->id,
            'posted_at' => $now->subHours(2),
        ]);
        Post::factory()->create([
            'source_id' => $source->id,
            'account_id' => $account->id,
            'posted_at' => $now->subHours(5),
        ]);

        $response = $this->getJson('/api/v1/dashboard/summary')->assertOk();
        $trend = $response->json('data.trend_24h');

        $this->assertCount(24, $trend);
        $totalVolume = array_sum(array_column($trend, 'volume'));
        $this->assertSame(3, $totalVolume);
    }

    public function test_data_notice_flags_simulated_posts(): void
    {
        $this->actingAsRole('analyst');

        $now = DataClock::now();
        $source = Source::factory()->create(['is_simulated' => true]);
        $account = Account::factory()->create();

        Post::factory()->create([
            'source_id' => $source->id,
            'account_id' => $account->id,
            'is_simulated' => true,
            'posted_at' => $now->subHours(1),
        ]);

        $response = $this->getJson('/api/v1/dashboard/summary')->assertOk();
        $this->assertTrue($response->json('data.data_notice.has_simulated_data'));
    }

    public function test_issues_returns_ranked_alerts_ordered_by_score_desc(): void
    {
        $this->actingAsRole('analyst');

        $alert1 = Alert::factory()->status('new')->create(['score' => 40]);
        $alert2 = Alert::factory()->status('reviewing')->create(['score' => 85]);
        $alert3 = Alert::factory()->status('escalated')->create(['score' => 70]);
        // Closed alert should be excluded
        Alert::factory()->status('closed')->create(['score' => 99]);

        $response = $this->getJson('/api/v1/dashboard/issues')
            ->assertOk()
            ->assertJsonCount(3, 'data');

        $scores = array_column($response->json('data'), 'score');
        $this->assertSame([85, 70, 40], $scores);
        $this->assertSame($alert2->id, $response->json('data.0.id'));
    }

    public function test_issues_is_role_scoped_for_leader(): void
    {
        $this->actingAsRole('leader');

        // Analyst only alerts
        Alert::factory()->status('new')->create(['score' => 95]);
        Alert::factory()->status('reviewing')->create(['score' => 90]);

        // Leader visible alerts
        $esc = Alert::factory()->status('escalated')->create(['score' => 75]);
        $ret = Alert::factory()->status('returned')->create(['score' => 65]);
        // Approved is terminal, should not be in active dashboard issues
        Alert::factory()->status('approved')->create(['score' => 85]);

        $response = $this->getJson('/api/v1/dashboard/issues')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $ids = array_column($response->json('data'), 'id');
        $this->assertSame([$esc->id, $ret->id], $ids);
    }

    public function test_issues_handles_empty_state(): void
    {
        $this->actingAsRole('analyst');

        $response = $this->getJson('/api/v1/dashboard/issues')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }
}
