<?php

namespace Database\Factories;

use App\Models\ReplayRow;
use App\Models\ReplayScenario;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ReplayRow>
 */
class ReplayRowFactory extends Factory
{
    public function definition(): array
    {
        return [
            'scenario_id' => ReplayScenario::factory(),
            'offset_seconds' => fake()->numberBetween(0, 3600),
            'phase' => 'baseline',
            'text' => fake()->sentence(10),
            'account_handle' => '@'.fake()->unique()->lexify('akun?????'),
            'account_display_name' => null,
            'account_created_at' => null,
            'label_manual' => null,
        ];
    }

    public function incident(): static
    {
        return $this->state(['phase' => 'incident']);
    }
}
