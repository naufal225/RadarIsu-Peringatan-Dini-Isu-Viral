<?php

use App\Http\Controllers\Api\V1\DashboardController;
use Illuminate\Support\Facades\Route;

// PRD §11 (F8).

Route::get('dashboard/summary', [DashboardController::class, 'summary'])->middleware('permission:dashboard.view');
Route::get('dashboard/issues', [DashboardController::class, 'issues'])->middleware('permission:dashboard.view');
