<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['source_type', 'handle', 'display_name', 'platform_created_at', 'first_seen_at'])]
class Account extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'platform_created_at' => 'datetime',
            'first_seen_at' => 'datetime',
        ];
    }

    public function posts(): HasMany
    {
        return $this->hasMany(Post::class);
    }
}
