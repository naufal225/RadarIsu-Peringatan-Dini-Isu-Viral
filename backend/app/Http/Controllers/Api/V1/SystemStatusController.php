<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\Setting;
use App\Models\Source;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * `GET /system/status` (PRD §11).
 */
class SystemStatusController extends Controller
{
    private const RECENT_FAILURES = 5;

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
            // Insight: sebaran sentimen semua posting. Kalau satu label mendominasi, kamus belum menangkap sinyal.
            'sentiment' => [
                'positive' => DB::table('posts')->where('sentiment', 'positive')->count(),
                'negative' => DB::table('posts')->where('sentiment', 'negative')->count(),
                'neutral' => DB::table('posts')->where('sentiment', 'neutral')->count(),
            ],
            'offline_mode' => (bool) (Setting::find('offline_mode')?->value['enabled'] ?? false),
        ]]);
    }
}
