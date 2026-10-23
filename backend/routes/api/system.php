<?php

use App\Http\Controllers\Api\V1\SystemStatusController;
use Illuminate\Support\Facades\Route;

// PRD §11.

Route::get('system/status', [SystemStatusController::class, 'systemStatus'])->middleware('permission:system.status');
