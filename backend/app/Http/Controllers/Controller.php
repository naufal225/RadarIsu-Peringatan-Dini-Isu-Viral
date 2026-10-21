<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

abstract class Controller
{
    /**
     * 501 for routes whose business logic lands in a later phase (PRD v2.1 §11).
     * Authentication, permission middleware and policies still run in front of it.
     */
    protected function pendingPhase(int $phase): JsonResponse
    {
        return response()->json([
            'message' => 'Belum diimplementasikan',
            'meta' => ['pending_phase' => $phase],
        ], 501);
    }
}
