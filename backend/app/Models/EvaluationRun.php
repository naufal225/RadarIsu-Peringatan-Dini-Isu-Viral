<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['scenario_id', 'run_by', 'labeled_posts', 'tp', 'fp', 'fn', 'precision', 'recall', 'f1', 'detection_latency_seconds', 'notes'])]
class EvaluationRun extends Model
{
    protected function casts(): array
    {
        return [
            'precision' => 'decimal:4',
            'recall' => 'decimal:4',
            'f1' => 'decimal:4',
        ];
    }
}
