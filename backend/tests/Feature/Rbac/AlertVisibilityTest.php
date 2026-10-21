<?php

namespace Tests\Feature\Rbac;

use App\Models\Alert;
use App\Models\Briefing;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * PRD §19.1 additional tests 1–2 and §8.4 object-level rules.
 */
class AlertVisibilityTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    public static function hiddenStatuses(): array
    {
        return [
            'new' => ['new'],
            'reviewing' => ['reviewing'],
            'false_positive' => ['false_positive'],
            'closed' => ['closed'],
        ];
    }

    #[DataProvider('hiddenStatuses')]
    public function test_leader_cannot_open_hidden_alert(string $status): void
    {
        $alert = Alert::factory()->status($status)->create();
        $this->actingAsRole('leader');

        // PRD v2.1 §19.1 additional 1: 404 so the alert's existence does not leak.
        $this->getJson("/api/v1/alerts/{$alert->id}")->assertNotFound();
    }

    public function test_leader_can_open_visible_alert(): void
    {
        $alert = Alert::factory()->status('escalated')->create();
        $this->actingAsRole('leader');

        $this->getJson("/api/v1/alerts/{$alert->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $alert->id)
            ->assertJsonPath('data.status', 'escalated');
    }

    public function test_analyst_can_open_any_alert(): void
    {
        $alert = Alert::factory()->status('new')->create();
        $this->actingAsRole('analyst');

        $this->getJson("/api/v1/alerts/{$alert->id}")->assertOk();
    }

    public function test_leader_alert_list_never_contains_hidden_statuses(): void
    {
        foreach (Alert::STATUSES as $status) {
            Alert::factory()->status($status)->create();
        }
        $this->actingAsRole('leader');

        $statuses = collect($this->getJson('/api/v1/alerts')->assertOk()->json('data'))->pluck('status');

        $this->assertEqualsCanonicalizing(['escalated', 'approved', 'returned'], $statuses->all());
    }

    public function test_leader_status_filter_cannot_widen_scope(): void
    {
        Alert::factory()->status('new')->create();
        $this->actingAsRole('leader');

        $this->getJson('/api/v1/alerts?status=new')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_analyst_alert_list_contains_all_statuses(): void
    {
        foreach (Alert::STATUSES as $status) {
            Alert::factory()->status($status)->create();
        }
        $this->actingAsRole('analyst');

        $this->getJson('/api/v1/alerts')->assertOk()->assertJsonCount(count(Alert::STATUSES), 'data');
    }

    public function test_leader_cannot_download_briefing_of_hidden_alert(): void
    {
        $briefing = Briefing::factory()->for(Alert::factory()->status('reviewing'))->create();
        $this->actingAsRole('leader');

        $this->getJson("/api/v1/briefings/{$briefing->id}/download")->assertNotFound();
    }

    public function test_leader_cannot_comment_on_hidden_alert(): void
    {
        $alert = Alert::factory()->status('reviewing')->create();
        $this->actingAsRole('leader');

        $this->postJson("/api/v1/alerts/{$alert->id}/comments", ['note' => 'x'])->assertNotFound();
    }

    public static function hiddenTransitions(): array
    {
        return [
            'approve new' => ['new', 'approve'],
            'approve reviewing' => ['reviewing', 'approve'],
            'return reviewing' => ['reviewing', 'return'],
            'approve closed' => ['closed', 'approve'],
            'return false_positive' => ['false_positive', 'return'],
        ];
    }

    #[DataProvider('hiddenTransitions')]
    public function test_leader_transition_on_hidden_alert_is_not_found(string $status, string $action): void
    {
        $alert = Alert::factory()->status($status)->create();
        $this->actingAsRole('leader');

        $this->postJson("/api/v1/alerts/{$alert->id}/$action", ['note' => 'x'])->assertNotFound();
        $this->assertSame($status, $alert->fresh()->status);
    }

    public function test_check_order_permission_then_visibility_then_state(): void
    {
        $hidden = Alert::factory()->status('reviewing')->create();
        $visibleTerminal = Alert::factory()->status('approved')->create();

        // (a) permission middleware → 403, even for an alert the role could not see.
        $this->actingAsRole('admin');
        $this->postJson("/api/v1/alerts/{$hidden->id}/approve")->assertForbidden();

        // (b) policy view → 404.
        $this->resetAuth();
        $this->actingAsRole('leader');
        $this->postJson("/api/v1/alerts/{$hidden->id}/approve")->assertNotFound();

        // (c) state machine → 422.
        $this->postJson("/api/v1/alerts/{$visibleTerminal->id}/approve")->assertUnprocessable();
    }

    public function test_briefing_cannot_be_created_for_new_alert(): void
    {
        $alert = Alert::factory()->status('new')->create();
        $this->actingAsRole('analyst');

        $this->postJson("/api/v1/alerts/{$alert->id}/briefings")->assertUnprocessable();
    }
}
