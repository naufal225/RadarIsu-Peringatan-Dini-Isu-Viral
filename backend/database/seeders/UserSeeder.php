<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * Demo accounts (PRD §9.8). The demo password MUST be changed on any production deploy.
     */
    public function run(): void
    {
        $password = env('DEMO_USER_PASSWORD', 'radarisu-demo-2026');

        $users = [
            'admin' => ['admin@radarisu.test', 'Admin Demo'],
            'analyst' => ['analyst@radarisu.test', 'Analis Demo'],
            'leader' => ['leader@radarisu.test', 'Pimpinan Demo'],
        ];

        foreach ($users as $roleSlug => [$email, $name]) {
            User::updateOrCreate(['email' => $email], [
                'name' => $name,
                'password' => $password,
                'role_id' => Role::where('slug', $roleSlug)->value('id'),
                'is_active' => true,
            ]);
        }
    }
}
