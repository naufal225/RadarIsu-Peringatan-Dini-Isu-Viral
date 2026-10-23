<?php

use App\Http\Controllers\Api\V1\SourceController;
use Illuminate\Support\Facades\Route;

// PRD §11 (F1).

Route::get('sources', [SourceController::class, 'index'])->middleware('permission:sources.view');
Route::post('sources', [SourceController::class, 'store'])->middleware('permission:sources.manage');
Route::patch('sources/{source}', [SourceController::class, 'update'])->middleware('permission:sources.manage');
Route::post('sources/{source}/test', [SourceController::class, 'test'])->middleware('permission:sources.manage');
