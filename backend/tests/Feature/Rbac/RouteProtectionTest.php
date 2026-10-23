<?php

namespace Tests\Feature\Rbac;

use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Route as RouteFacade;
use Tests\TestCase;

/**
 * PRD §11: every route except login is behind auth:sanctum + active + permission:<slug>.
 * Reads the live route table, so a route added to any routes/api/*.php file is covered
 * without updating the hardcoded list in AccessMatrixTest.
 */
class RouteProtectionTest extends TestCase
{
    private const PUBLIC_ROUTES = ['api/v1/auth/login'];

    /** Routes any signed-in user may call (PRD §11: "login"). */
    private const SESSION_ROUTES = ['api/v1/auth/logout', 'api/v1/auth/me'];

    /**
     * @return list<Route>
     */
    private function apiRoutes(): array
    {
        $routes = array_values(array_filter(
            RouteFacade::getRoutes()->getRoutes(),
            fn (Route $route) => str_starts_with($route->uri(), 'api/v1/'),
        ));
        $this->assertNotEmpty($routes);

        return $routes;
    }

    public function test_every_route_except_login_requires_active_token(): void
    {
        foreach ($this->apiRoutes() as $route) {
            if (in_array($route->uri(), self::PUBLIC_ROUTES, true)) {
                continue;
            }

            $middleware = $route->gatherMiddleware();
            $this->assertContains('auth:sanctum', $middleware, "{$route->uri()} lacks auth:sanctum");
            $this->assertContains('active', $middleware, "{$route->uri()} lacks active");
        }
    }

    public function test_every_protected_route_checks_a_known_permission(): void
    {
        $known = array_keys(config('permissions.permissions'));

        foreach ($this->apiRoutes() as $route) {
            if (in_array($route->uri(), [...self::PUBLIC_ROUTES, ...self::SESSION_ROUTES], true)) {
                continue;
            }

            $permissions = array_values(array_filter(
                $route->gatherMiddleware(),
                fn ($m) => is_string($m) && str_starts_with($m, 'permission:'),
            ));
            $label = implode('|', $route->methods()).' '.$route->uri();

            $this->assertCount(1, $permissions, "$label must have exactly one permission middleware");
            $this->assertContains(substr($permissions[0], strlen('permission:')), $known, "$label uses an unknown permission");
        }
    }

    public function test_login_is_public_and_throttled(): void
    {
        $login = collect($this->apiRoutes())->first(fn (Route $route) => $route->uri() === 'api/v1/auth/login');

        $this->assertNotNull($login);
        $this->assertNotContains('auth:sanctum', $login->gatherMiddleware());
        $this->assertContains('throttle:login', $login->gatherMiddleware());
    }
}
