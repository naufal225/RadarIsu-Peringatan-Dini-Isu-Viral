<?php

namespace App\Http\Resources;

use App\Models\EvaluationRun;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Aggregates of one evaluation run. Never lists accounts or posts, so every role may read it (PRD §15).
 *
 * @mixin EvaluationRun
 */
class EvaluationRunResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'scenario' => $this->whenLoaded('scenario', fn () => $this->scenario ? ['id' => $this->scenario->id, 'name' => $this->scenario->name] : null),
            'run_by' => $this->whenLoaded('runner', fn () => $this->runner?->name),
            'labeled_posts' => $this->labeled_posts,
            'tp' => $this->tp,
            'fp' => $this->fp,
            'fn' => $this->fn,
            'precision' => $this->precision === null ? null : (float) $this->precision,
            'recall' => $this->recall === null ? null : (float) $this->recall,
            'f1' => $this->f1 === null ? null : (float) $this->f1,
            'detection_latency_seconds' => $this->detection_latency_seconds,
            'notes' => $this->notes === null ? [] : explode(',', $this->notes),
            'created_at' => $this->created_at,
        ];
    }
}
