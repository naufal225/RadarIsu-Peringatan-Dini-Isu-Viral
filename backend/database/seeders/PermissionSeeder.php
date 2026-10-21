<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    /**
     * Seed permissions and the role → permission matrix from config/permissions.php.
     */
    public function run(): void
    {
        foreach (config('permissions.permissions') as $slug => [$name, $group]) {
            Permission::updateOrCreate(['slug' => $slug], ['name' => $name, 'group' => $group]);
        }

        foreach (config('permissions.matrix') as $roleSlug => $permissionSlugs) {
            Role::where('slug', $roleSlug)->firstOrFail()
                ->permissions()
                ->sync(Permission::whereIn('slug', $permissionSlugs)->pluck('id'));
        }
    }
}
