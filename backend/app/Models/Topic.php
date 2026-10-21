<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'category', 'keywords', 'sensitivity', 'is_template', 'is_active', 'created_by'])]
class Topic extends Model
{
    use HasFactory;

    public const CATEGORIES = ['institution', 'impersonation', 'opsec', 'general'];

    public const SENSITIVITIES = ['low', 'medium', 'high'];

    protected function casts(): array
    {
        return [
            'keywords' => 'array',
            'is_template' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function metrics(): HasMany
    {
        return $this->hasMany(MetricHourly::class);
    }

    public function alerts(): HasMany
    {
        return $this->hasMany(Alert::class);
    }
}
