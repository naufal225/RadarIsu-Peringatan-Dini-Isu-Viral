<?php

namespace Tests\Feature\Auth;

use App\Models\AuditLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Middleware\TrustProxies;
use Tests\TestCase;

/**
 * PRD v2.1 §13 (Phase 1 security item): X-Forwarded-For is honoured only from the BFF address,
 * so login throttling and audit logs see the real client IP and cannot be spoofed by clients.
 */
class TrustedProxyTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private const BFF_IP = '172.28.0.10';

    protected function setUp(): void
    {
        parent::setUp();
        TrustProxies::at([self::BFF_IP]);
    }

    protected function tearDown(): void
    {
        TrustProxies::flushState();
        parent::tearDown();
    }

    public function test_forwarded_for_from_bff_is_used(): void
    {
        $this->loginAttemptFrom(self::BFF_IP, '203.0.113.7');

        $this->assertSame('203.0.113.7', AuditLog::sole()->ip_address);
    }

    public function test_forwarded_for_from_other_hosts_is_ignored(): void
    {
        $this->loginAttemptFrom('198.51.100.20', '203.0.113.7');

        $this->assertSame('198.51.100.20', AuditLog::sole()->ip_address);
    }

    public function test_throttle_is_keyed_on_forwarded_client_ip(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->loginAttemptFrom(self::BFF_IP, '203.0.113.7')->assertUnprocessable();
        }

        $this->loginAttemptFrom(self::BFF_IP, '203.0.113.7')->assertTooManyRequests();
        // Another client behind the same BFF keeps its own budget.
        $this->loginAttemptFrom(self::BFF_IP, '203.0.113.8')->assertUnprocessable();
    }

    private function loginAttemptFrom(string $remoteAddr, string $forwardedFor)
    {
        return $this->withServerVariables(['REMOTE_ADDR' => $remoteAddr])
            ->withHeader('X-Forwarded-For', $forwardedFor)
            ->postJson('/api/v1/auth/login', ['email' => 'analyst@radarisu.test', 'password' => 'wrong-password']);
    }
}
