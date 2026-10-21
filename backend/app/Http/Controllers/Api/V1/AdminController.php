<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ReplayScenario;
use Illuminate\Http\JsonResponse;

/**
 * Admin-only endpoints whose logic lands in later phases (PRD §11).
 */
class AdminController extends Controller
{
    // TODO Fase 2: audit log list with filters.
    public function auditLogs(): JsonResponse
    {
        return $this->pendingPhase(2);
    }

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

    // TODO Fase 7: detection settings.
    public function showDetectionSettings(): JsonResponse
    {
        return $this->pendingPhase(7);
    }

    public function updateDetectionSettings(): JsonResponse
    {
        return $this->pendingPhase(7);
    }

    // TODO Fase 2: system health.
    public function systemStatus(): JsonResponse
    {
        return $this->pendingPhase(2);
    }
}
