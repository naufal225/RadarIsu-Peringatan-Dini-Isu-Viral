<?php

namespace Tests\Feature\Users;

use App\Models\AuditLog;
use App\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * PRD §8.4 and §19.1 additional test 4.
 */
class SelfDeactivationTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    public static function falsyActiveValues(): array
    {
        // Values Laravel's `boolean` rule accepts as false.
        return ['bool false' => [false], 'int 0' => [0], 'string "0"' => ['0']];
    }

    #[DataProvider('falsyActiveValues')]
    public function test_admin_cannot_deactivate_self(mixed $value): void
    {
        $admin = $this->actingAsRole('admin');

        $this->patchJson("/api/v1/users/{$admin->id}", ['is_active' => $value])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('is_active');

        $this->assertTrue($admin->fresh()->is_active);
        $this->assertSame(1, $admin->tokens()->count(), 'session must survive the rejected request');
        $this->assertSame(0, AuditLog::count(), 'rejected request must not be audited as a change');

        $this->resetAuth();
        $this->getJson('/api/v1/auth/me')->assertOk();
    }

    public function test_admin_cannot_demote_self(): void
    {
        $admin = $this->actingAsRole('admin');

        $this->patchJson("/api/v1/users/{$admin->id}", ['role' => 'analyst'])->assertUnprocessable();
        $this->assertSame('admin', $admin->fresh()->role->slug);
    }

    public function test_admin_can_deactivate_another_user_and_tokens_are_revoked(): void
    {
        $other = $this->userWithRole('analyst');
        $other->createToken('x');
        $this->actingAsRole('admin');

        $this->patchJson("/api/v1/users/{$other->id}", ['is_active' => false])->assertOk();

        $this->assertFalse($other->fresh()->is_active);
        $this->assertSame(0, $other->tokens()->count());
    }

    public function test_role_change_takes_effect_immediately(): void
    {
        $other = $this->userWithRole('analyst');
        $this->assertTrue($other->hasPermission('alerts.triage'));
        $this->actingAsRole('admin');

        $this->patchJson("/api/v1/users/{$other->id}", ['role' => 'leader'])->assertOk();

        $other = $other->fresh();
        $this->assertSame(Role::where('slug', 'leader')->value('id'), $other->role_id);
        $this->assertFalse($other->hasPermission('alerts.triage'));
        $this->assertTrue($other->hasPermission('alerts.decide'));
    }
}
