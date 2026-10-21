<?php

use App\Http\Controllers\Api\V1\AdminController;
use App\Http\Controllers\Api\V1\AlertActionController;
use App\Http\Controllers\Api\V1\AlertController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BriefingController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\EvaluationController;
use App\Http\Controllers\Api\V1\OfficialAccountController;
use App\Http\Controllers\Api\V1\SourceController;
use App\Http\Controllers\Api\V1\TopicController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\Route;

/*
| PRD §11. Every route except login: auth:sanctum + active + permission:<slug>.
*/

Route::prefix('v1')->group(function () {
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:login');

    Route::middleware(['auth:sanctum', 'active'])->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::get('auth/me', [AuthController::class, 'me']);

        Route::get('users', [UserController::class, 'index'])->middleware('permission:users.view');
        Route::post('users', [UserController::class, 'store'])->middleware('permission:users.manage');
        Route::patch('users/{user}', [UserController::class, 'update'])->middleware('permission:users.manage');

        Route::get('sources', [SourceController::class, 'index'])->middleware('permission:sources.view');
        Route::post('sources', [SourceController::class, 'store'])->middleware('permission:sources.manage');
        Route::patch('sources/{source}', [SourceController::class, 'update'])->middleware('permission:sources.manage');
        Route::post('sources/{source}/test', [SourceController::class, 'test'])->middleware('permission:sources.manage');
        Route::post('sources/{source}/import', [SourceController::class, 'import'])->middleware('permission:sources.manage');
        Route::get('sources/{source}/imports', [SourceController::class, 'imports'])->middleware('permission:sources.view');

        Route::get('topics', [TopicController::class, 'index'])->middleware('permission:topics.view');
        Route::post('topics', [TopicController::class, 'store'])->middleware('permission:topics.manage');
        Route::patch('topics/{topic}', [TopicController::class, 'update'])->middleware('permission:topics.manage');
        Route::get('topics/{topic}/metrics', [TopicController::class, 'metrics'])->middleware('permission:topics.view');

        Route::get('official-accounts', [OfficialAccountController::class, 'index'])->middleware('permission:topics.view');
        Route::post('official-accounts', [OfficialAccountController::class, 'store'])->middleware('permission:topics.manage');
        Route::delete('official-accounts/{officialAccount}', [OfficialAccountController::class, 'destroy'])->middleware('permission:topics.manage');

        Route::get('dashboard/summary', [DashboardController::class, 'summary'])->middleware('permission:dashboard.view');
        Route::get('dashboard/issues', [DashboardController::class, 'issues'])->middleware('permission:dashboard.view');

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

        Route::get('briefings', [BriefingController::class, 'index'])->middleware('permission:briefings.view');
        Route::post('alerts/{alert}/briefings', [BriefingController::class, 'store'])->middleware('permission:briefings.create');
        Route::get('briefings/{briefing}/download', [BriefingController::class, 'download'])->middleware('permission:briefings.download');

        Route::get('audit-logs', [AdminController::class, 'auditLogs'])->middleware('permission:audit.view');

        Route::middleware('permission:replay.manage')->group(function () {
            Route::get('replay/scenarios', [AdminController::class, 'replayScenarios']);
            Route::post('replay/scenarios', [AdminController::class, 'storeReplayScenario']);
            Route::post('replay/scenarios/{scenario}/start', [AdminController::class, 'startReplay']);
            Route::post('replay/scenarios/{scenario}/stop', [AdminController::class, 'stopReplay']);
        });

        Route::get('settings/detection', [AdminController::class, 'showDetectionSettings'])->middleware('permission:settings.manage');
        Route::put('settings/detection', [AdminController::class, 'updateDetectionSettings'])->middleware('permission:settings.manage');

        Route::get('labeling/posts', [EvaluationController::class, 'labelingPosts'])->middleware('permission:labels.manage');
        Route::put('labeling/posts/{post}', [EvaluationController::class, 'labelPost'])->middleware('permission:labels.manage');

        Route::get('evaluation/runs', [EvaluationController::class, 'runs'])->middleware('permission:evaluation.view');
        Route::post('evaluation/run', [EvaluationController::class, 'run'])->middleware('permission:evaluation.run');

        Route::get('system/status', [AdminController::class, 'systemStatus'])->middleware('permission:system.status');
    });
});
