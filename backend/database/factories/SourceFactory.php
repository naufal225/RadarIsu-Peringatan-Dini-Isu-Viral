<?php

namespace Database\Factories;

use App\Models\Source;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Source>
 */
class SourceFactory extends Factory
{
    public function definition(): array
    {
        return [
            'type' => 'csv',
            'name' => fake()->company(),
            'config' => [],
            'interval_minutes' => null,
            'is_active' => true,
            'is_simulated' => false,
            'last_status' => 'never',
            'created_by' => User::factory()->role('admin'),
        ];
    }
}
