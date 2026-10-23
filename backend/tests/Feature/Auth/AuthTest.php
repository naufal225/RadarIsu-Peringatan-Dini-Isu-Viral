<?php

namespace Tests\Feature\Auth;

use App\Models\AuditLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * PRD §11 /auth/* and §19.1 additional tests 3 and 5.
 */
class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private const PASSWORD = 'correct-horse-battery';

    public function test_login_returns_token_and_user(): void
    {
        $user = $this->userWithRole('analyst', ['password' => self::PASSWORD]);

        $response = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => self::PASSWORD]);

        $response->assertOk()
            ->assertJsonStructure(['data' => ['token', 'user' => ['id', 'name', 'email']]])
            ->assertJsonPath('data.user.id', $user->id);
        $this->assertNotNull($user->fresh()->last_login_at);
        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.login', 'user_id' => $user->id]);
    }

    public function test_failed_login_is_rejected_and_audited(): void
    {
        $user = $this->userWithRole('analyst', ['password' => self::PASSWORD]);

        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'wrong-password'])
            ->assertUnprocessable();
        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.login_failed']);
    }

    public function test_me_returns_role_and_permissions(): void
    {
        $user = $this->actingAsRole('analyst');

        $this->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.user.id', $user->id)
            ->assertJsonPath('data.role.slug', 'analyst')
            ->assertJsonPath('data.permissions', [
                'topics.view', 'topics.manage', 'dashboard.view', 'alerts.view', 'alerts.triage',
                'briefings.view', 'briefings.create', 'briefings.download', 'labels.manage',
                'evaluation.view', 'evaluation.run',
            ]);
    }

    public function test_logout_revokes_current_token(): void
    {
        $user = $this->actingAsRole('leader');

        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->resetAuth();

        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->assertSame(0, $user->tokens()->count());
        $this->assertSame(1, AuditLog::where('action', 'auth.logout')->count());
    }

    public function test_token_expires_after_eight_hours(): void
    {
        $user = $this->userWithRole('analyst', ['password' => self::PASSWORD]);
        $token = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => self::PASSWORD])
            ->json('data.token');

        // PRD §13: sanctum.expiration = 480 minutes.
        $this->travel(479)->minutes();
        $this->withToken($token)->getJson('/api/v1/auth/me')->assertOk();

        $this->resetAuth();
        $this->travel(2)->minutes();
        $this->withToken($token)->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_inactive_user_cannot_login(): void
    {
        $user = $this->userWithRole('analyst', ['password' => self::PASSWORD, 'is_active' => false]);

        $status = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => self::PASSWORD])
            ->status();

        $this->assertContains($status, [401, 422]);
    }

    public function test_token_of_inactive_user_is_rejected(): void
    {
        $user = $this->actingAsRole('analyst');
        // Bypass model events to prove the request-time check, not only revocation on update.
        $user->newQuery()->whereKey($user->id)->update(['is_active' => false]);

        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_deactivating_user_revokes_tokens(): void
    {
        $user = $this->userWithRole('analyst');
        $user->createToken('a');
        $user->createToken('b');

        $user->update(['is_active' => false]);

        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_sixth_failed_login_within_a_minute_is_throttled(): void
    {
        $user = $this->userWithRole('analyst', ['password' => self::PASSWORD]);
        $payload = ['email' => $user->email, 'password' => 'wrong-password'];

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/login', $payload)->assertUnprocessable();
        }

        $this->postJson('/api/v1/auth/login', $payload)->assertTooManyRequests();
    }
}
