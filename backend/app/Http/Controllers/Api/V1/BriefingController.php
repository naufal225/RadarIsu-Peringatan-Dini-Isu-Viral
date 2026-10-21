<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\Briefing;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class BriefingController extends Controller
{
    // TODO Fase 6: list briefings (leader: only those whose alert is visible).
    public function index(): JsonResponse
    {
        return $this->pendingPhase(6);
    }

    public function store(Alert $alert): JsonResponse
    {
        Gate::authorize('createBriefing', $alert);

        if ($alert->status === 'new') {
            throw ValidationException::withMessages(['status' => ['Briefings cannot be created for new alerts.']]);
        }

        // TODO Fase 6: generate PDF (barryvdh/laravel-dompdf) and log briefing.create.
        return $this->pendingPhase(6);
    }

    public function download(Briefing $briefing): JsonResponse
    {
        Gate::authorize('download', $briefing);

        // TODO Fase 6: stream the PDF and log briefing.download.
        return $this->pendingPhase(6);
    }
}
