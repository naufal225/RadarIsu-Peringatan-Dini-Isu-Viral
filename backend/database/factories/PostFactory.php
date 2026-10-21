<?php

namespace Database\Factories;

use App\Models\Account;
use App\Models\Post;
use App\Models\Source;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Post>
 */
class PostFactory extends Factory
{
    public function definition(): array
    {
        $text = fake()->sentence(12);

        return [
            'source_id' => Source::factory(),
            'account_id' => Account::factory(),
            'external_id' => null,
            'text' => $text,
            'text_norm' => mb_strtolower($text),
            'posted_at' => now()->subMinutes(fake()->numberBetween(1, 600)),
            'is_simulated' => false,
        ];
    }
}
