<?php

namespace Tests\Feature\Users;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * PRD §11 /users (Phase 2).
 */
class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    public function test_admin_lists_users_with_role_and_status(): void
    {
        $this->actingAsRole('admin');

        $this->getJson('/api/v1/users')
            ->assertOk()
            ->assertJsonStructure(['data' => [['id', 'name', 'email', 'role', 'is_active', 'last_login_at']], 'meta' => ['total']])
            ->assertJsonMissingPath('data.0.password');
    }

    public function test_admin_creates_user(): void
    {
        $this->actingAsRole('admin');

        $this->withHeader('User-Agent', 'PhpUnit/Phase2')->postJson('/api/v1/users', [
            'name' => 'Analis Baru',
            'email' => 'baru@radarisu.test',
            'password' => 'sandi-panjang-sekali',
            'role' => 'analyst',
        ])
            ->assertCreated()
            ->assertJsonPath('data.email', 'baru@radarisu.test')
            ->assertJsonPath('data.role', 'analyst')
            ->assertJsonPath('data.is_active', true);

        $user = User::where('email', 'baru@radarisu.test')->firstOrFail();
        $this->assertTrue(Hash::check('sandi-panjang-sekali', $user->password));

        $log = AuditLog::where('action', 'user.create')->sole();
        $this->assertSame($user->id, $log->object_id);
        $this->assertSame('PhpUnit/Phase2', $log->user_agent);
        $this->assertNotEmpty($log->ip_address);
        $this->assertStringNotContainsString('sandi-panjang-sekali', json_encode($log->detail));
    }

    public function test_create_user_validation(): void
    {
        $this->actingAsRole('admin');

        $this->postJson('/api/v1/users', [
            'name' => '',
            'email' => 'analyst@radarisu.test', // taken by the seeder
            'password' => 'pendek',
            'role' => 'superuser',
        ])->assertUnprocessable()->assertJsonValidationErrors(['name', 'email', 'password', 'role']);

        $this->assertSame(0, AuditLog::count());
    }

    public function test_deactivation_is_audited_as_deactivate(): void
    {
        $other = $this->userWithRole('leader');
        $this->actingAsRole('admin');

        $this->patchJson("/api/v1/users/{$other->id}", ['is_active' => false])->assertOk();

        $this->assertSame(1, AuditLog::where('action', 'user.deactivate')->where('object_id', $other->id)->count());
    }
}
