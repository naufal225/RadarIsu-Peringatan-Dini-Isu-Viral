<?php

namespace Tests\Unit;

use App\Support\PermissionsTypeScript;
use Tests\TestCase;

/**
 * Guards against drift between config/permissions.php and the generated frontend file.
 */
class PermissionsTypeScriptTest extends TestCase
{
    public function test_generated_frontend_file_is_up_to_date(): void
    {
        $path = PermissionsTypeScript::defaultPath();

        if (! is_file($path)) {
            $this->markTestSkipped('frontend/ is not present (e.g. backend-only container).');
        }

        $this->assertSame(
            str_replace("\r\n", "\n", PermissionsTypeScript::render()),
            str_replace("\r\n", "\n", file_get_contents($path)),
            'Run `php artisan permissions:export-ts` after changing config/permissions.php.',
        );
    }

    public function test_every_matrix_slug_is_a_declared_permission(): void
    {
        $declared = array_keys(config('permissions.permissions'));

        foreach (config('permissions.matrix') as $role => $slugs) {
            $this->assertArrayHasKey($role, config('permissions.roles'));
            $this->assertSame([], array_values(array_diff($slugs, $declared)), "Unknown permission for $role");
        }
    }
}
