<?php

use App\Http\Controllers\Api\V1\OfficialAccountController;
use App\Http\Controllers\Api\V1\OfficialAccountLookalikeController;
use App\Http\Controllers\Api\V1\TopicController;
use App\Http\Controllers\Api\V1\TopicCoordinationController;
use App\Http\Controllers\Api\V1\TopicSpikeController;
use Illuminate\Support\Facades\Route;

// PRD §11 (F2).

Route::get('topics', [TopicController::class, 'index'])->middleware('permission:topics.view');
Route::post('topics', [TopicController::class, 'store'])->middleware('permission:topics.manage');
Route::patch('topics/{topic}', [TopicController::class, 'update'])->middleware('permission:topics.manage');
Route::get('topics/{topic}/metrics', [TopicController::class, 'metrics'])->middleware('permission:topics.view');
// Names accounts and quotes posts before any escalation, so analysts only (F4).
Route::get('topics/{topic}/coordination', TopicCoordinationController::class)->middleware('permission:alerts.triage');
Route::get('topics/{topic}/spike-baseline', TopicSpikeController::class)->middleware('permission:topics.view');

Route::get('official-accounts', [OfficialAccountController::class, 'index'])->middleware('permission:topics.view');
// Names accounts as suspected impersonators before any escalation, so analysts only (F13).
Route::get('official-accounts/lookalikes', OfficialAccountLookalikeController::class)->middleware('permission:alerts.triage');
Route::post('official-accounts', [OfficialAccountController::class, 'store'])->middleware('permission:topics.manage');
Route::delete('official-accounts/{officialAccount}', [OfficialAccountController::class, 'destroy'])->middleware('permission:topics.manage');

// Insight (F2): cakupan posting oleh topik. Sebelum topics/{topic} agar tidak tertangkap parameter.
Route::get('topics/coverage', [\App\Http\Controllers\Api\V1\InsightController::class, 'topicCoverage'])->middleware('permission:topics.view');
