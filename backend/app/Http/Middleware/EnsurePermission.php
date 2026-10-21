<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Route guard `permission:<slug>` (PRD §8.2, §13). Object-level rules live in policies.
 */
class EnsurePermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();

        abort_unless($user, 401);
        abort_unless($user->hasPermission($permission), 403);

        return $next($request);
    }
}
