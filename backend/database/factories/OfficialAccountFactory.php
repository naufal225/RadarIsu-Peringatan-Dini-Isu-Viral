<?php

namespace Database\Factories;

use App\Models\OfficialAccount;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OfficialAccount>
 */
class OfficialAccountFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->lexify('satuan?????');

        return [
            'handle' => '@'.$name,
            'display_name' => ucfirst($name).' Resmi',
            'note' => null,
            'created_by' => User::factory()->role('admin'),
        ];
    }
}
