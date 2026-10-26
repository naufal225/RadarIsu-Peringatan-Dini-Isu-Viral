<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['scenario_id', 'run_by', 'labeled_posts', 'tp', 'fp', 'fn', 'precision', 'recall', 'f1', 'detection_latency_seconds', 'notes'])]
class EvaluationRun extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'precision' => 'decimal:4',
            'recall' => 'decimal:4',
            'f1' => 'decimal:4',
        ];
    }

    public function scenario(): BelongsTo
    {
        return $this->belongsTo(ReplayScenario::class, 'scenario_id');
    }

    public function runner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'run_by');
    }
}
