<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'description', 'total_rows', 'incident_start_offset_seconds', 'default_speed_factor', 'status', 'started_at', 'virtual_anchor_at', 'created_by'])]
class ReplayScenario extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'virtual_anchor_at' => 'datetime',
        ];
    }

    public function rows(): HasMany
    {
        return $this->hasMany(ReplayRow::class, 'scenario_id');
    }
}
