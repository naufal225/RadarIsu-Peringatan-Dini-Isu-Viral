<?php

namespace Database\Factories;

use App\Models\Topic;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Topic>
 */
class TopicFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->sentence(3),
            'category' => fake()->randomElement(Topic::CATEGORIES),
            'keywords' => fake()->words(3),
            'sensitivity' => 'medium',
            'is_template' => false,
            'is_active' => true,
            'created_by' => null,
        ];
    }
}
