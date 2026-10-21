<?php

namespace Database\Factories;

use App\Models\Alert;
use App\Models\Topic;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Alert>
 */
class AlertFactory extends Factory
{
    public function definition(): array
    {
        $detectedAt = now()->subMinutes(fake()->numberBetween(5, 600));

        return [
            'kind' => 'issue',
            'topic_id' => Topic::factory(),
            'subject_account_id' => null,
            'score' => fake()->numberBetween(0, 100),
            'severity' => fake()->randomElement(Alert::SEVERITIES),
            'score_breakdown' => [],
            'status' => 'new',
            'detected_at' => $detectedAt,
            'window_start' => $detectedAt->copy()->subHour(),
            'window_end' => $detectedAt,
        ];
    }

    /**
     * Put the alert in a workflow status with the timestamps that status implies.
     */
    public function status(string $status): static
    {
        return $this->state(fn () => array_filter([
            'status' => $status,
            'recommendation' => in_array($status, ['escalated', 'returned', 'approved'], true) ? 'Rekomendasi uji.' : null,
            'escalated_at' => in_array($status, ['escalated', 'returned', 'approved'], true) ? now() : null,
            'decided_at' => in_array($status, ['returned', 'approved'], true) ? now() : null,
            'closed_at' => in_array($status, ['false_positive', 'closed'], true) ? now() : null,
        ], fn ($value) => $value !== null));
    }
}
