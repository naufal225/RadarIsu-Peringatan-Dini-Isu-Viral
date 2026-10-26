<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AlertResource;
use App\Models\Alert;
use App\Services\Detection\DataClock;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

/**
 * Situation dashboard endpoints (PRD §11.2, §12.2, docs/CONTRACTS.md §2.4, §3.2).
 * F8 (Domain C - Rekishi).
 */
class DashboardController extends Controller
{
    /**
     * Role-scoped situation summary (active issues, highest severity, awaiting decision, 24h trend).
     */
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();
        $isLeader = $user->role->slug === 'leader';

        // 1. Role-scoped active issues and awaiting decision
        if ($isLeader) {
            // For leader, only escalated, approved, returned are counted.
            // Active issues are the open ones: escalated, returned.
            $activeQuery = Alert::query()->whereIn('status', ['escalated', 'returned']);
            $activeIssues = (clone $activeQuery)->count();
            $awaitingDecision = Alert::query()->where('status', 'escalated')->count();
            $highestSeverity = $this->calculateHighestSeverity($activeQuery);
        } else {
            // For analyst, all open alerts
            $activeQuery = Alert::query()->whereIn('status', Alert::OPEN_STATUSES);
            $activeIssues = (clone $activeQuery)->count();
            $awaitingDecision = Alert::query()->where('status', 'escalated')->count();
            $highestSeverity = $this->calculateHighestSeverity($activeQuery);
        }

        // 2. 24-hour volume trend ending at DataClock::now()
        $now = DataClock::now();
        $currentHour = $now->startOfHour();
        $startHour = $currentHour->subHours(23);

        $hourlyVolumes = DB::table('posts')
            ->where('posted_at', '>=', $startHour)
            ->where('posted_at', '<', $currentHour->addHour())
            ->groupBy(DB::raw("date_trunc('hour', posted_at)"))
            ->selectRaw("date_trunc('hour', posted_at) as hour, count(*) as volume")
            ->pluck('volume', 'hour')
            ->all();

        $trend24h = [];
        for ($i = 0; $i < 24; $i++) {
            $point = $startHour->addHours($i);
            $ts = $point->getTimestamp();
            $vol = 0;
            foreach ($hourlyVolumes as $dbHour => $count) {
                if (CarbonImmutable::parse($dbHour)->getTimestamp() === $ts) {
                    $vol = (int) $count;
                    break;
                }
            }
            $trend24h[] = [
                'hour' => $point->utc()->format('Y-m-d\TH:i:s\Z'),
                'volume' => $vol,
            ];
        }

        // 3. Notice if any simulated data exists in window or active alerts
        $hasSimulatedData = DB::table('posts')
            ->where('posted_at', '>=', $startHour)
            ->where('posted_at', '<', $currentHour->addHour())
            ->where('is_simulated', true)
            ->exists();

        if (! $hasSimulatedData) {
            $hasSimulatedData = Alert::query()
                ->visibleTo($user)
                ->whereIn('status', Alert::OPEN_STATUSES)
                ->where(function ($q) {
                    $q->whereHas('topic', fn ($t) => $t->where('name', 'like', '%simulasi%'))
                      ->orWhereHas('evidence.post', fn ($p) => $p->where('is_simulated', true));
                })
                ->exists();
        }

        return response()->json([
            'data' => [
                'active_issues' => $activeIssues,
                'highest_severity' => $highestSeverity,
                'awaiting_decision' => $awaitingDecision,
                'trend_24h' => $trend24h,
                'data_notice' => [
                    'has_simulated_data' => $hasSimulatedData,
                ],
            ],
        ]);
    }

    /**
     * Ranked active issues, role-scoped, ordered by threat score descending.
     */
    public function issues(Request $request): AnonymousResourceCollection
    {
        $limit = $request->integer('limit', 10);
        $limit = $limit > 0 ? min($limit, 50) : 10;

        $issues = Alert::query()
            ->visibleTo($request->user())
            ->whereIn('status', Alert::OPEN_STATUSES)
            ->with(['topic', 'subjectAccount'])
            ->orderByDesc('score')
            ->orderByDesc('detected_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get();

        return AlertResource::collection($issues);
    }

    /**
     * Calculate highest severity among given query ('high' > 'medium' > 'low' > null).
     */
    private function calculateHighestSeverity($query): ?string
    {
        $severities = (clone $query)->distinct()->pluck('severity')->all();
        if (in_array('high', $severities, true)) {
            return 'high';
        }
        if (in_array('medium', $severities, true)) {
            return 'medium';
        }
        if (in_array('low', $severities, true)) {
            return 'low';
        }

        return null;
    }
}
