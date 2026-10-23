<?php

use App\Http\Controllers\Api\V1\AuditLogController;
use Illuminate\Support\Facades\Route;

// PRD §11 (F10).

Route::get('audit-logs', [AuditLogController::class, 'auditLogs'])->middleware('permission:audit.view');
