<?php

namespace Tests\Feature\Audit;

use App\Models\Alert;
use App\Models\AlertAction;
use App\Models\AuditLog;
use App\Services\Audit\AuditLogger;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Tests\TestCase;

/**
 * PRD §9.6–§9.7, §11 GET /audit-logs, §13 append-only audit.
 */
class AuditLogTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private function entry(string $action, ?int $userId, string $createdAt): AuditLog
    {
        // created_at is set explicitly to test date filters; direct inserts are fine in tests.
        $id = DB::table('audit_logs')->insertGetId([
            'user_id' => $userId,
            'action' => $action,
            'detail' => '{}',
            'ip_address' => '203.0.113.1',
            'created_at' => $createdAt,
        ]);

        return AuditLog::findOrFail($id);
    }

    public function test_lists_newest_first_with_user_name(): void
    {
        $analyst = $this->userWithRole('analyst', ['name' => 'Analis X']);
        $this->entry('auth.login', $analyst->id, '2026-10-01 08:00:00+00');
        $this->entry('auth.logout', $analyst->id, '2026-10-02 08:00:00+00');
        $this->actingAsRole('admin');

        $this->getJson('/api/v1/audit-logs')
            ->assertOk()
            ->assertJsonPath('data.0.action', 'auth.logout')
            ->assertJsonPath('data.0.user.name', 'Analis X')
            ->assertJsonPath('data.1.action', 'auth.login')
            ->assertJsonStructure(['data' => [['id', 'action', 'object_type', 'object_id', 'detail', 'ip_address', 'user_agent', 'created_at', 'user']], 'meta' => ['total', 'per_page']]);
    }

    public function test_filters_by_user_action_and_date_range(): void
    {
        $a = $this->userWithRole('analyst');
        $b = $this->userWithRole('leader');
        $this->entry('auth.login', $a->id, '2026-10-01 08:00:00+00');
        $this->entry('auth.login', $b->id, '2026-10-05 08:00:00+00');
        $this->entry('auth.logout', $a->id, '2026-10-06 08:00:00+00');
        $this->entry('auth.login', $a->id, '2026-10-10 08:00:00+00');
        $this->actingAsRole('admin');

        $this->getJson("/api/v1/audit-logs?user_id={$a->id}")->assertJsonCount(3, 'data');
        $this->getJson('/api/v1/audit-logs?action=auth.login')->assertJsonCount(3, 'data');
        $this->getJson('/api/v1/audit-logs?from=2026-10-02&to=2026-10-06')->assertJsonCount(2, 'data');
        $this->getJson("/api/v1/audit-logs?user_id={$a->id}&action=auth.login&from=2026-10-02")->assertJsonCount(1, 'data');
    }

    public function test_to_date_is_inclusive_of_the_whole_day(): void
    {
        $this->entry('auth.login', null, '2026-10-06 23:30:00+00');
        $this->actingAsRole('admin');

        $this->getJson('/api/v1/audit-logs?to=2026-10-06')->assertJsonCount(1, 'data');
    }

    public function test_filter_validation(): void
    {
        $this->actingAsRole('admin');

        $this->getJson('/api/v1/audit-logs?action=not.an.action&from=kemarin')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['action', 'from']);
    }

    public function test_paginates_by_50(): void
    {
        for ($i = 0; $i < 55; $i++) {
            $this->entry('auth.login', null, '2026-10-01 08:00:00+00');
        }
        $this->actingAsRole('admin');

        $this->getJson('/api/v1/audit-logs')->assertJsonCount(50, 'data')->assertJsonPath('meta.total', 55);
        $this->getJson('/api/v1/audit-logs?page=2')->assertJsonCount(5, 'data');
    }

    public function test_database_rejects_update_and_delete_of_audit_logs(): void
    {
        $log = $this->entry('auth.login', null, '2026-10-01 08:00:00+00');

        $this->assertRejectedByDatabase(fn () => DB::table('audit_logs')->where('id', $log->id)->update(['action' => 'auth.logout']));
        $this->assertRejectedByDatabase(fn () => DB::table('audit_logs')->where('id', $log->id)->delete());

        $this->assertSame('auth.login', $log->fresh()->action);
    }

    public function test_database_rejects_update_and_delete_of_alert_actions(): void
    {
        $alert = Alert::factory()->status('reviewing')->create();
        $action = AlertAction::create(['alert_id' => $alert->id, 'action' => 'take', 'from_status' => 'new', 'to_status' => 'reviewing']);

        $this->assertRejectedByDatabase(fn () => DB::table('alert_actions')->where('id', $action->id)->update(['note' => 'diubah']));
        $this->assertRejectedByDatabase(fn () => DB::table('alert_actions')->where('id', $action->id)->delete());
    }

    public function test_logger_rejects_actions_outside_the_prd_list(): void
    {
        $this->expectException(InvalidArgumentException::class);

        app(AuditLogger::class)->log('user.created');
    }

    public function test_logger_action_list_matches_prd_section_9_7(): void
    {
        $this->assertSame([
            'auth.login', 'auth.login_failed', 'auth.logout', 'user.create', 'user.update', 'user.deactivate',
            'source.create', 'source.update', 'source.test', 'source.import', 'topic.create', 'topic.update',
            'official_account.create', 'official_account.delete', 'alert.take', 'alert.escalate',
            'alert.false_positive', 'alert.close', 'alert.approve', 'alert.return', 'alert.comment',
            'briefing.create', 'briefing.download', 'replay.start', 'replay.stop', 'settings.update',
            'label.set', 'evaluation.run',
        ], AuditLogger::ACTIONS);
    }

    /**
     * Runs the statement inside a savepoint so the aborted statement does not poison the test transaction.
     */
    private function assertRejectedByDatabase(callable $statement): void
    {
        try {
            DB::transaction($statement);
        } catch (QueryException $e) {
            $this->assertStringContainsString('append-only', $e->getMessage());

            return;
        }

        $this->fail('Expected the database to reject the statement.');
    }
}
