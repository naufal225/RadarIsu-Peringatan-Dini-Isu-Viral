<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\AuditLog;
use App\Models\ReplayScenario;
use App\Models\Setting;
use App\Models\Source;
use App\Services\Audit\AuditLogger;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Admin-only endpoints (PRD §11). Replay and detection settings land in Phase 7.
 */
class AdminController extends Controller
{
    private const AUDIT_PER_PAGE = 50;

    private const RECENT_FAILURES = 5;

    public function auditLogs(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'user_id' => 'nullable|integer',
            'action' => ['nullable', Rule::in(AuditLogger::ACTIONS)],
            'from' => 'nullable|date_format:Y-m-d',
            'to' => 'nullable|date_format:Y-m-d|after_or_equal:from',
        ]);

        $logs = AuditLog::query()
            ->with('user:id,name,email')
            ->when($filters['user_id'] ?? null, fn ($q, $id) => $q->where('user_id', $id))
            ->when($filters['action'] ?? null, fn ($q, $action) => $q->where('action', $action))
            ->when($filters['from'] ?? null, fn ($q, $from) => $q->where('created_at', '>=', CarbonImmutable::parse($from)->startOfDay()))
            // `to` covers the whole day.
            ->when($filters['to'] ?? null, fn ($q, $to) => $q->where('created_at', '<', CarbonImmutable::parse($to)->addDay()->startOfDay()))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(self::AUDIT_PER_PAGE);

        return response()->json([
            'data' => $logs->getCollection()->map(fn (AuditLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'object_type' => $log->object_type,
                'object_id' => $log->object_id,
                'detail' => (object) $log->detail,
                'ip_address' => $log->ip_address,
                'user_agent' => $log->user_agent,
                'created_at' => $log->created_at,
                'user' => $log->user ? ['id' => $log->user->id, 'name' => $log->user->name, 'email' => $log->user->email] : null,
            ]),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }

    public function systemStatus(): JsonResponse
    {
        $failures = DB::table('failed_jobs')->orderByDesc('failed_at')->limit(self::RECENT_FAILURES)->get()
            ->map(fn ($job) => [
                'id' => $job->id,
                'queue' => $job->queue,
                'job' => json_decode($job->payload, true)['displayName'] ?? null,
                'error' => Str::limit(strtok($job->exception, "\n") ?: '', 300),
                'failed_at' => $job->failed_at,
            ]);

        return response()->json(['data' => [
            'sources' => Source::orderBy('name')->get()->map(fn (Source $source) => $source->only([
                'id', 'type', 'name', 'is_active', 'is_simulated', 'last_status', 'last_fetched_at', 'last_error',
            ])),
            'queue' => [
                'pending_jobs' => DB::table('jobs')->count(),
                'failed_jobs' => DB::table('failed_jobs')->count(),
                'recent_failures' => $failures,
            ],
            'counts' => [
                'raw_items' => DB::table('raw_items')->count(),
                'unprocessed_raw_items' => DB::table('raw_items')->whereNull('processed_at')->count(),
                'posts' => DB::table('posts')->count(),
                'open_alerts' => Alert::whereIn('status', Alert::OPEN_STATUSES)->count(),
            ],
            'offline_mode' => (bool) (Setting::find('offline_mode')?->value['enabled'] ?? false),
        ]]);
    }

    // TODO Fase 7: replay scenarios.
    public function replayScenarios(): JsonResponse
    {
        return $this->pendingPhase(7);
    }

    public function storeReplayScenario(): JsonResponse
    {
        return $this->pendingPhase(7);
    }

    public function startReplay(ReplayScenario $scenario): JsonResponse
    {
        return $this->pendingPhase(7);
    }

    public function stopReplay(ReplayScenario $scenario): JsonResponse
    {
        return $this->pendingPhase(7);
    }

    // TODO Fase 7: detection settings.
    public function showDetectionSettings(): JsonResponse
    {
        return $this->pendingPhase(7);
    }

    public function updateDetectionSettings(): JsonResponse
    {
        return $this->pendingPhase(7);
    }
}
