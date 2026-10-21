<?php

namespace Tests\Feature\Rbac;

use App\Models\Alert;
use App\Models\Briefing;
use App\Models\Post;
use App\Models\ReplayScenario;
use App\Models\Source;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * PRD §19.1: role → route access matrix. true = 2xx, false = 403.
 */
class AccessMatrixTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    /**
     * @return array<string, array{string, string, string, bool}>
     */
    public static function matrix(): array
    {
        // [method, uri, fixture, admin, analyst, leader]
        $rows = [
            ['GET', '/users', 'none', true, false, false],
            ['POST', '/users', 'none', true, false, false],
            ['GET', '/sources', 'none', true, false, false],
            ['POST', '/sources', 'none', true, false, false],
            ['POST', '/sources/{id}/import', 'source', true, false, false],
            ['GET', '/topics', 'none', false, true, true],
            ['POST', '/topics', 'none', false, true, false],
            ['POST', '/official-accounts', 'none', false, true, false],
            ['GET', '/dashboard/summary', 'none', false, true, true],
            ['GET', '/alerts', 'none', false, true, true],
            ['POST', '/alerts/{id}/take', 'alert_new', false, true, false],
            ['POST', '/alerts/{id}/escalate', 'alert_reviewing', false, true, false],
            ['POST', '/alerts/{id}/approve', 'alert_escalated', false, false, true],
            ['POST', '/alerts/{id}/return', 'alert_escalated', false, false, true],
            ['POST', '/alerts/{id}/briefings', 'alert_reviewing', false, true, false],
            ['GET', '/briefings/{id}/download', 'briefing_visible', false, true, true],
            ['GET', '/audit-logs', 'none', true, false, false],
            ['POST', '/replay/scenarios/{id}/start', 'scenario', true, false, false],
            ['PUT', '/settings/detection', 'none', true, false, false],
            ['PUT', '/labeling/posts/{id}', 'post', false, true, false],
            ['POST', '/evaluation/run', 'none', true, true, false],
            ['GET', '/evaluation/runs', 'none', true, true, true],
            ['GET', '/system/status', 'none', true, false, false],
        ];

        $cases = [];
        foreach ($rows as [$method, $uri, $fixture, $admin, $analyst, $leader]) {
            foreach (['admin' => $admin, 'analyst' => $analyst, 'leader' => $leader] as $role => $allowed) {
                $cases["$role $method $uri"] = [$role, $method, $uri, $fixture, $allowed];
            }
        }

        return $cases;
    }

    #[DataProvider('matrix')]
    public function test_role_access_matrix(string $role, string $method, string $uri, string $fixture, bool $allowed): void
    {
        $id = $this->fixture($fixture);
        $this->actingAsRole($role);

        $response = $this->json($method, '/api/v1'.str_replace('{id}', (string) $id, $uri), $this->bodyFor($uri));

        if ($allowed) {
            // PRD v2.1 §19.1: routes of later phases are 501 stubs, so "allowed" means
            // the request got past authentication, permission and object visibility.
            $this->assertNotContains(
                $response->status(),
                [401, 403, 404],
                "Expected access for $role $method $uri, got {$response->status()}: {$response->getContent()}",
            );
        } else {
            $response->assertForbidden();
        }
    }

    /**
     * @return array<string, array{string, string}>
     */
    public static function protectedRoutes(): array
    {
        $routes = [
            ['POST', '/auth/logout'], ['GET', '/auth/me'],
            ['GET', '/users'], ['POST', '/users'], ['PATCH', '/users/1'],
            ['GET', '/sources'], ['POST', '/sources'], ['PATCH', '/sources/1'],
            ['POST', '/sources/1/test'], ['POST', '/sources/1/import'], ['GET', '/sources/1/imports'],
            ['GET', '/topics'], ['POST', '/topics'], ['PATCH', '/topics/1'], ['GET', '/topics/1/metrics'],
            ['GET', '/official-accounts'], ['POST', '/official-accounts'], ['DELETE', '/official-accounts/1'],
            ['GET', '/dashboard/summary'], ['GET', '/dashboard/issues'],
            ['GET', '/alerts'], ['GET', '/alerts/1'],
            ['POST', '/alerts/1/take'], ['POST', '/alerts/1/escalate'], ['POST', '/alerts/1/false-positive'],
            ['POST', '/alerts/1/close'], ['POST', '/alerts/1/approve'], ['POST', '/alerts/1/return'],
            ['POST', '/alerts/1/comments'],
            ['GET', '/briefings'], ['POST', '/alerts/1/briefings'], ['GET', '/briefings/1/download'],
            ['GET', '/audit-logs'],
            ['GET', '/replay/scenarios'], ['POST', '/replay/scenarios'],
            ['POST', '/replay/scenarios/1/start'], ['POST', '/replay/scenarios/1/stop'],
            ['GET', '/settings/detection'], ['PUT', '/settings/detection'],
            ['GET', '/labeling/posts'], ['PUT', '/labeling/posts/1'],
            ['GET', '/evaluation/runs'], ['POST', '/evaluation/run'],
            ['GET', '/system/status'],
        ];

        $cases = [];
        foreach ($routes as [$method, $uri]) {
            $cases["$method $uri"] = [$method, $uri];
        }

        return $cases;
    }

    #[DataProvider('protectedRoutes')]
    public function test_every_route_except_login_requires_token(string $method, string $uri): void
    {
        $this->json($method, '/api/v1'.$uri)->assertUnauthorized();
    }

    public function test_stub_route_returns_501_with_pending_phase(): void
    {
        $this->actingAsRole('admin');

        $this->getJson('/api/v1/users')
            ->assertStatus(501)
            ->assertExactJson(['message' => 'Belum diimplementasikan', 'meta' => ['pending_phase' => 2]]);
    }

    public function test_permission_is_checked_before_stub(): void
    {
        $this->actingAsRole('analyst');

        $this->getJson('/api/v1/users')->assertForbidden();
    }

    private function fixture(string $fixture): ?int
    {
        return match ($fixture) {
            'none' => null,
            'source' => Source::factory()->create(['type' => 'csv'])->id,
            'alert_new' => Alert::factory()->status('new')->create()->id,
            'alert_reviewing' => Alert::factory()->status('reviewing')->create()->id,
            'alert_escalated' => Alert::factory()->status('escalated')->create()->id,
            'briefing_visible' => Briefing::factory()
                ->for(Alert::factory()->status('escalated'))
                ->create()->id,
            'scenario' => ReplayScenario::factory()->create()->id,
            'post' => Post::factory()->create()->id,
        };
    }

    private function bodyFor(string $uri): array
    {
        return match (true) {
            str_ends_with($uri, '/escalate') => ['recommendation' => 'Koordinasikan klarifikasi resmi.'],
            str_ends_with($uri, '/return') => ['note' => 'Perlu analisis lanjutan.'],
            str_starts_with($uri, '/labeling/posts') => ['label_manual' => 'organic'],
            default => [],
        };
    }
}
