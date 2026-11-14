<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database (PRD §9.8).
     */
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            PermissionSeeder::class,
            UserSeeder::class,
            TopicTemplateSeeder::class,
            SettingsSeeder::class,
        ]);

        // Data demo lengkap hanya untuk lingkungan lokal; produksi tidak pernah menerima data simulasi.
        if (app()->environment('local')) {
            $this->call(FullDemoSeeder::class);
        }
    }
}
