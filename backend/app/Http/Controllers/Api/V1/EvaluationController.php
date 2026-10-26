<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

// TODO Fase 7: evaluation runs (the labeling queue is LabelingController) (PRD §15).
class EvaluationController extends Controller
{
    public function runs(): JsonResponse
    {
        return $this->pendingPhase(7);
    }

    public function run(): JsonResponse
    {
        return $this->pendingPhase(7);
    }
}
