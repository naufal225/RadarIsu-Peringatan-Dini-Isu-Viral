<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\OfficialAccount;
use Illuminate\Http\JsonResponse;

// TODO Fase 3: official account list for impersonation detection (PRD §11).
class OfficialAccountController extends Controller
{
    public function index(): JsonResponse
    {
        return $this->pendingPhase(3);
    }

    public function store(): JsonResponse
    {
        return $this->pendingPhase(3);
    }

    public function destroy(OfficialAccount $officialAccount): JsonResponse
    {
        return $this->pendingPhase(3);
    }
}
