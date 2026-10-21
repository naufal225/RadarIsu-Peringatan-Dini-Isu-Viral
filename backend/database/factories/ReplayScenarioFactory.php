<?php

namespace Database\Factories;

use App\Models\ReplayScenario;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ReplayScenario>
 */
class ReplayScenarioFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->sentence(3),
            'description' => null,
            'total_rows' => 0,
            'incident_start_offset_seconds' => null,
            'default_speed_factor' => 60,
            'status' => 'idle',
            'created_by' => User::factory()->role('admin'),
        ];
    }
}
