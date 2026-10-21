<?php

namespace Tests\Feature\Alerts;

use App\Models\Alert;
use App\Models\AlertAction;
use App\Models\AuditLog;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * PRD §19.2: alert workflow (§8.5 state machine).
 */
class AlertWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    // 1
    public function test_analyst_takes_new_alert(): void
    {
        $alert = Alert::factory()->status('new')->create();
        $analyst = $this->actingAsRole('analyst');

        $this->postJson("/api/v1/alerts/{$alert->id}/take")
            ->assertOk()
            ->assertJsonPath('data.status', 'reviewing');

        $this->assertSame($analyst->id, $alert->fresh()->assigned_to);
    }

    public function test_leader_cannot_take(): void
    {
        $alert = Alert::factory()->status('new')->create();
        $this->actingAsRole('leader');

        $this->postJson("/api/v1/alerts/{$alert->id}/take")->assertForbidden();
        $this->assertSame('new', $alert->fresh()->status);
    }

    // 2
    public function test_escalate_requires_recommendation(): void
    {
        $alert = Alert::factory()->status('reviewing')->create();
        $this->actingAsRole('analyst');

        $this->postJson("/api/v1/alerts/{$alert->id}/escalate")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('recommendation');
        $this->assertSame('reviewing', $alert->fresh()->status);
    }

    public function test_escalate_with_recommendation(): void
    {
        $alert = Alert::factory()->status('reviewing')->create();
        $this->actingAsRole('analyst');

        $this->postJson("/api/v1/alerts/{$alert->id}/escalate", ['recommendation' => 'Rilis klarifikasi.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'escalated');

        $alert->refresh();
        $this->assertSame('Rilis klarifikasi.', $alert->recommendation);
        $this->assertNotNull($alert->escalated_at);
    }

    // 3
    public function test_leader_approves_escalated(): void
    {
        $alert = Alert::factory()->status('escalated')->create();
        $this->actingAsRole('leader');

        $this->postJson("/api/v1/alerts/{$alert->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');
        $this->assertNotNull($alert->fresh()->decided_at);
    }

    public function test_approve_on_reviewing_is_not_found_for_leader(): void
    {
        // PRD v2.1 §19.2 item 3: a reviewing alert is invisible to the leader → 404 before the state machine.
        $alert = Alert::factory()->status('reviewing')->create();
        $this->actingAsRole('leader');

        $this->postJson("/api/v1/alerts/{$alert->id}/approve")->assertNotFound();
        $this->assertSame('reviewing', $alert->fresh()->status);
    }

    public function test_approve_on_visible_non_escalated_is_invalid_transition(): void
    {
        $alert = Alert::factory()->status('returned')->create();
        $this->actingAsRole('leader');

        $this->postJson("/api/v1/alerts/{$alert->id}/approve")->assertUnprocessable();
        $this->assertSame('returned', $alert->fresh()->status);
    }

    // 4
    public function test_return_requires_note(): void
    {
        $alert = Alert::factory()->status('escalated')->create();
        $this->actingAsRole('leader');

        $this->postJson("/api/v1/alerts/{$alert->id}/return")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('note');
    }

    public function test_return_with_note(): void
    {
        $alert = Alert::factory()->status('escalated')->create();
        $this->actingAsRole('leader');

        $this->postJson("/api/v1/alerts/{$alert->id}/return", ['note' => 'Tambahkan data sumber.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'returned');
    }

    // 5
    public function test_returned_alert_can_be_escalated_again(): void
    {
        $alert = Alert::factory()->status('returned')->create();
        $this->actingAsRole('analyst');

        $this->postJson("/api/v1/alerts/{$alert->id}/escalate", ['recommendation' => 'Analisis tambahan.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'escalated');
    }

    public function test_returned_alert_can_be_closed(): void
    {
        $alert = Alert::factory()->status('returned')->create();
        $this->actingAsRole('analyst');

        $this->postJson("/api/v1/alerts/{$alert->id}/close", ['note' => 'Isu mereda.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'closed');
        $this->assertNotNull($alert->fresh()->closed_at);
    }

    public function test_close_and_false_positive_require_note(): void
    {
        $alert = Alert::factory()->status('reviewing')->create();
        $this->actingAsRole('analyst');

        $this->postJson("/api/v1/alerts/{$alert->id}/close")->assertJsonValidationErrors('note');
        $this->postJson("/api/v1/alerts/{$alert->id}/false-positive")->assertJsonValidationErrors('note');
    }

    // 6
    public static function terminalActions(): array
    {
        $actions = [
            ['take', 'analyst'], ['escalate', 'analyst'], ['false-positive', 'analyst'],
            ['close', 'analyst'], ['approve', 'leader'], ['return', 'leader'],
        ];

        $cases = [];
        foreach (Alert::TERMINAL_STATUSES as $status) {
            foreach ($actions as [$action, $role]) {
                $cases["$status $action"] = [$status, $action, $role];
            }
        }

        return $cases;
    }

    #[DataProvider('terminalActions')]
    public function test_terminal_status_rejects_actions(string $status, string $action, string $role): void
    {
        $alert = Alert::factory()->status($status)->create();
        $this->actingAsRole($role);

        $response = $this->postJson("/api/v1/alerts/{$alert->id}/$action", ['recommendation' => 'x', 'note' => 'x']);

        // PRD v2.1 §19.2 item 6: 422, unless the alert is invisible to the role (leader on
        // false_positive/closed), where the visibility check answers 404 first.
        $hiddenFromRole = $role === 'leader' && ! in_array($status, Alert::LEADER_VISIBLE_STATUSES, true);
        $response->assertStatus($hiddenFromRole ? 404 : 422);
        $this->assertSame($status, $alert->fresh()->status);
    }

    public static function terminalStatuses(): array
    {
        return array_combine(Alert::TERMINAL_STATUSES, array_map(fn ($s) => [$s], Alert::TERMINAL_STATUSES));
    }

    #[DataProvider('terminalStatuses')]
    public function test_terminal_status_accepts_comment(string $status): void
    {
        $alert = Alert::factory()->status($status)->create();
        $this->actingAsRole('analyst');

        $this->postJson("/api/v1/alerts/{$alert->id}/comments", ['note' => 'Catatan arsip.'])->assertCreated();
        $this->assertSame($status, $alert->fresh()->status);
    }

    public function test_comment_requires_note_and_is_rejected_on_new(): void
    {
        $reviewing = Alert::factory()->status('reviewing')->create();
        $new = Alert::factory()->status('new')->create();
        $this->actingAsRole('analyst');

        $this->postJson("/api/v1/alerts/{$reviewing->id}/comments")->assertJsonValidationErrors('note');
        $this->postJson("/api/v1/alerts/{$new->id}/comments", ['note' => 'x'])->assertUnprocessable();
    }

    public function test_leader_comments_on_visible_alert(): void
    {
        $alert = Alert::factory()->status('escalated')->create();
        $this->actingAsRole('leader');

        $this->postJson("/api/v1/alerts/{$alert->id}/comments", ['note' => 'Mohon pantau terus.'])
            ->assertCreated();
    }

    // 7
    public function test_each_successful_action_writes_one_action_and_one_audit_row(): void
    {
        $alert = Alert::factory()->status('new')->create();
        $analyst = $this->userWithRole('analyst');
        $leader = $this->userWithRole('leader');
        $analystToken = $analyst->createToken('t')->plainTextToken;
        $leaderToken = $leader->createToken('t')->plainTextToken;

        $steps = [
            [$analystToken, 'take', [], 'reviewing'],
            [$analystToken, 'comments', ['note' => 'Sedang dianalisis.'], 'reviewing'],
            [$analystToken, 'escalate', ['recommendation' => 'Klarifikasi.'], 'escalated'],
            [$leaderToken, 'return', ['note' => 'Perdalam.'], 'returned'],
            [$analystToken, 'escalate', ['recommendation' => 'Klarifikasi v2.'], 'escalated'],
            [$leaderToken, 'approve', [], 'approved'],
        ];

        foreach ($steps as [$token, $action, $body, $expectedStatus]) {
            $actionsBefore = AlertAction::count();
            $auditBefore = AuditLog::count();

            $this->resetAuth();
            $this->withToken($token)->postJson("/api/v1/alerts/{$alert->id}/$action", $body)->assertSuccessful();

            $this->assertSame($actionsBefore + 1, AlertAction::count(), "alert_actions after $action");
            $this->assertSame($auditBefore + 1, AuditLog::count(), "audit_logs after $action");
            $this->assertSame($expectedStatus, $alert->fresh()->status);
        }

        $this->assertSame(
            ['take', 'comment', 'escalate', 'return', 'escalate', 'approve'],
            AlertAction::where('alert_id', $alert->id)->orderBy('id')->pluck('action')->all(),
        );
        $this->assertSame(6, AuditLog::where('object_type', 'alert')->where('object_id', $alert->id)->count());
    }

    public function test_failed_action_writes_nothing(): void
    {
        $alert = Alert::factory()->status('reviewing')->create();
        $this->actingAsRole('analyst');

        $this->postJson("/api/v1/alerts/{$alert->id}/escalate")->assertUnprocessable();
        $this->postJson("/api/v1/alerts/{$alert->id}/take")->assertUnprocessable();

        $this->assertSame(0, AlertAction::count());
        $this->assertSame(0, AuditLog::count());
    }

    // 8
    public function test_detector_does_not_duplicate_open_alert(): void
    {
        $this->markTestIncomplete('PRD §19.2 butir 8 bergantung pada detektor (Fase 4).');
    }

    public function test_database_rejects_second_open_issue_alert_for_same_topic(): void
    {
        $alert = Alert::factory()->status('reviewing')->create();

        $this->expectException(UniqueConstraintViolationException::class);
        Alert::factory()->status('new')->create(['topic_id' => $alert->topic_id]);
    }
}
