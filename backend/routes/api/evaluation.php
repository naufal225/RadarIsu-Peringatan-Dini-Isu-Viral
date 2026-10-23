<?php

use App\Http\Controllers\Api\V1\EvaluationController;
use Illuminate\Support\Facades\Route;

// PRD §11 (F14).

Route::get('evaluation/runs', [EvaluationController::class, 'runs'])->middleware('permission:evaluation.view');
Route::post('evaluation/run', [EvaluationController::class, 'run'])->middleware('permission:evaluation.run');
