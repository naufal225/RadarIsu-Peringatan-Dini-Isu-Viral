<?php

namespace Tests;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Create a user with the given role slug.
     */
    protected function userWithRole(string $roleSlug, array $attributes = []): User
    {
        return User::factory()
            ->create(['role_id' => Role::where('slug', $roleSlug)->value('id')] + $attributes);
    }

    /**
     * Authenticate subsequent requests with a real Sanctum bearer token for a user with the given role.
     */
    protected function actingAsRole(string $roleSlug, array $attributes = []): User
    {
        $user = $this->userWithRole($roleSlug, $attributes);
        $this->withToken($user->createToken('test')->plainTextToken);

        return $user;
    }

    /**
     * Drop cached guard state so the next request re-resolves the bearer token.
     */
    protected function resetAuth(): void
    {
        $this->app['auth']->forgetGuards();
    }
}
