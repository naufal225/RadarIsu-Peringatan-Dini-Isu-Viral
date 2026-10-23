<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ReplayScenario;
use Illuminate\Http\JsonResponse;

/**
 * Replay scenarios (PRD §10.10, §11). Lands in Phase 7.
 */
class ReplayController extends Controller
{
    // TODO Fase 7: replay scenarios.
    public function replayScenarios(): JsonResponse
    {
        return $this->pendingPhase(7);
    }

    public function storeReplayScenario(): JsonResponse
    {
        return $this->pendingPhase(7);
    }

    public function startReplay(ReplayScenario $scenario): JsonResponse
    {
        return $this->pendingPhase(7);
    }

    public function stopReplay(ReplayScenario $scenario): JsonResponse
    {
        return $this->pendingPhase(7);
    }
}
