<?php

use App\Http\Controllers\Api\V1\AlertActionController;
use App\Http\Controllers\Api\V1\AlertController;
use Illuminate\Support\Facades\Route;

// PRD §11, §8.4-8.5 (F6).

Route::get('alerts', [AlertController::class, 'index'])->middleware('permission:alerts.view');
Route::get('alerts/{alert}', [AlertController::class, 'show'])->middleware('permission:alerts.view');
Route::middleware('permission:alerts.triage')->group(function () {
    Route::post('alerts/{alert}/take', [AlertActionController::class, 'take']);
    Route::post('alerts/{alert}/escalate', [AlertActionController::class, 'escalate']);
    Route::post('alerts/{alert}/false-positive', [AlertActionController::class, 'falsePositive']);
    Route::post('alerts/{alert}/close', [AlertActionController::class, 'close']);
});
Route::middleware('permission:alerts.decide')->group(function () {
    Route::post('alerts/{alert}/approve', [AlertActionController::class, 'approve']);
    Route::post('alerts/{alert}/return', [AlertActionController::class, 'returnToAnalyst']);
});
Route::post('alerts/{alert}/comments', [AlertActionController::class, 'comment'])->middleware('permission:alerts.view');
