<?php

use App\Http\Controllers\Api\V1\AuditLogController;
use Illuminate\Support\Facades\Route;

// PRD §11 (F10).

Route::get('audit-logs', [AuditLogController::class, 'auditLogs'])->middleware('permission:audit.view');

// Insight (F10): agregat untuk halaman audit.
Route::get('audit-logs/summary', [\App\Http\Controllers\Api\V1\InsightController::class, 'auditSummary'])->middleware('permission:audit.view');
