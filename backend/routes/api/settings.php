<?php

use App\Http\Controllers\Api\V1\SettingController;
use Illuminate\Support\Facades\Route;

// PRD §11 (F15).

Route::get('settings/detection', [SettingController::class, 'showDetectionSettings'])->middleware('permission:settings.manage');
Route::put('settings/detection', [SettingController::class, 'updateDetectionSettings'])->middleware('permission:settings.manage');
Route::get('settings/offline-mode', [SettingController::class, 'showOfflineMode'])->middleware('permission:settings.manage');
Route::put('settings/offline-mode', [SettingController::class, 'updateOfflineMode'])->middleware('permission:settings.manage');
