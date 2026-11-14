<?php

use App\Http\Controllers\Api\V1\InsightController;
use App\Http\Controllers\Api\V1\ReplayController;
use Illuminate\Support\Facades\Route;

// PRD §11, §10.10 (F11).

Route::middleware('permission:replay.manage')->group(function () {
    Route::get('replay/scenarios', [ReplayController::class, 'replayScenarios']);
    Route::post('replay/scenarios', [ReplayController::class, 'storeReplayScenario']);
    Route::post('replay/scenarios/{scenario}/start', [ReplayController::class, 'startReplay']);
    Route::post('replay/scenarios/{scenario}/stop', [ReplayController::class, 'stopReplay']);
    // Insight: komposisi baris skenario (baseline/incident, label manual).
    Route::get('replay/scenarios/{scenario}/composition', [InsightController::class, 'replayComposition']);
    Route::get('replay/scenarios/{scenario}/series', [InsightController::class, 'replaySeries']);
});
