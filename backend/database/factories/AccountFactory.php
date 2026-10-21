<?php

namespace Database\Factories;

use App\Models\Account;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Account>
 */
class AccountFactory extends Factory
{
    public function definition(): array
    {
        return [
            'source_type' => 'csv',
            'handle' => '@'.fake()->unique()->userName(),
            'display_name' => fake()->name(),
            'platform_created_at' => fake()->dateTimeBetween('-3 years', '-1 month'),
            'first_seen_at' => now(),
        ];
    }
}
