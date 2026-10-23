<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

/**
 * Detection settings (PRD §9.6, §11, F15). Lands in Phase 7.
 */
class SettingController extends Controller
{
    // TODO Fase 7: detection settings.
    public function showDetectionSettings(): JsonResponse
    {
        return $this->pendingPhase(7);
    }

    public function updateDetectionSettings(): JsonResponse
    {
        return $this->pendingPhase(7);
    }
}
