<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

// TODO Fase 6: role-scoped dashboard (PRD §11.2).
class DashboardController extends Controller
{
    public function summary(): JsonResponse
    {
        return $this->pendingPhase(6);
    }

    public function issues(): JsonResponse
    {
        return $this->pendingPhase(6);
    }
}
