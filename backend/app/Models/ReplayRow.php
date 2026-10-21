<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['scenario_id', 'offset_seconds', 'phase', 'text', 'account_handle', 'account_display_name', 'account_created_at', 'label_manual'])]
class ReplayRow extends Model
{
    protected function casts(): array
    {
        return ['account_created_at' => 'datetime'];
    }

    public function scenario(): BelongsTo
    {
        return $this->belongsTo(ReplayScenario::class, 'scenario_id');
    }
}
