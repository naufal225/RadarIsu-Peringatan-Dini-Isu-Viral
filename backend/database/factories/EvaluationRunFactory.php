<?php

namespace Database\Factories;

use App\Models\EvaluationRun;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EvaluationRun>
 */
class EvaluationRunFactory extends Factory
{
    public function definition(): array
    {
        return [
            'scenario_id' => null,
            'run_by' => User::factory()->role('analyst'),
            'labeled_posts' => 100,
            'tp' => 8, 'fp' => 2, 'fn' => 2,
            'precision' => 0.8, 'recall' => 0.8, 'f1' => 0.8,
            'detection_latency_seconds' => 300,
            'notes' => null,
        ];
    }
}
