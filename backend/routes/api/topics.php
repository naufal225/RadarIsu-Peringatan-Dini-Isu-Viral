<?php

use App\Http\Controllers\Api\V1\OfficialAccountController;
use App\Http\Controllers\Api\V1\TopicController;
use App\Http\Controllers\Api\V1\TopicSpikeController;
use Illuminate\Support\Facades\Route;

// PRD §11 (F2).

Route::get('topics', [TopicController::class, 'index'])->middleware('permission:topics.view');
Route::post('topics', [TopicController::class, 'store'])->middleware('permission:topics.manage');
Route::patch('topics/{topic}', [TopicController::class, 'update'])->middleware('permission:topics.manage');
Route::get('topics/{topic}/metrics', [TopicController::class, 'metrics'])->middleware('permission:topics.view');
Route::get('topics/{topic}/spike-baseline', TopicSpikeController::class)->middleware('permission:topics.view');

Route::get('official-accounts', [OfficialAccountController::class, 'index'])->middleware('permission:topics.view');
Route::post('official-accounts', [OfficialAccountController::class, 'store'])->middleware('permission:topics.manage');
Route::delete('official-accounts/{officialAccount}', [OfficialAccountController::class, 'destroy'])->middleware('permission:topics.manage');
