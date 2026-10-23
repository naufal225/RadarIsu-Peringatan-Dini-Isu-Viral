<?php

use App\Http\Controllers\Api\V1\BriefingController;
use Illuminate\Support\Facades\Route;

// PRD §11 (F9).

Route::get('briefings', [BriefingController::class, 'index'])->middleware('permission:briefings.view');
Route::post('alerts/{alert}/briefings', [BriefingController::class, 'store'])->middleware('permission:briefings.create');
Route::get('briefings/{briefing}/download', [BriefingController::class, 'download'])->middleware('permission:briefings.download');
