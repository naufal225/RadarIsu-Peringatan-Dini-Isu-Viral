<?php

namespace Database\Factories;

use App\Models\Alert;
use App\Models\Briefing;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Briefing>
 */
class BriefingFactory extends Factory
{
    public function definition(): array
    {
        return [
            'alert_id' => Alert::factory()->status('reviewing'),
            'created_by' => User::factory(),
            'title' => fake()->sentence(4),
            'summary' => fake()->paragraph(),
            'content' => ['timeline' => [], 'evidence_ids' => [], 'recommendation' => null, 'decision' => null],
            'file_path' => null,
        ];
    }
}
