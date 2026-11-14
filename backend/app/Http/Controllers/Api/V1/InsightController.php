<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ReplayScenario;
use Carbon\CarbonImmutable;
use App\Models\Topic;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Agregat untuk insight di halaman yang sudah ada (PRD §6.1). Hanya membaca data; tidak menulis apa pun.
 */
class InsightController extends Controller
{
    /** `GET /audit-logs/summary`: jumlah per aksi dan per hari, dengan filter tanggal yang sama seperti daftar. */
    public function auditSummary(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'from' => 'nullable|date_format:Y-m-d',
            'to' => 'nullable|date_format:Y-m-d|after_or_equal:from',
        ]);

        $base = DB::table('audit_logs')
            ->when($filters['from'] ?? null, fn ($q, $from) => $q->where('created_at', '>=', $from))
            ->when($filters['to'] ?? null, fn ($q, $to) => $q->where('created_at', '<', date('Y-m-d', strtotime($to.' +1 day'))));

        $byAction = (clone $base)->select('action', DB::raw('count(*) as total'))->groupBy('action')
            ->orderByDesc('total')->pluck('total', 'action');
        $byDay = (clone $base)->selectRaw("to_char(created_at, 'YYYY-MM-DD') as day, count(*) as total")
            ->groupBy('day')->orderBy('day')->get()->map(fn ($row) => ['day' => $row->day, 'total' => (int) $row->total]);

        return response()->json(['data' => [
            'total' => (int) (clone $base)->count(),
            'by_action' => $byAction->map(fn ($n) => (int) $n),
            'by_day' => $byDay,
        ]]);
    }

    /** `GET /labeling/daily`: sebaran label per tanggal posting (UTC). Tanggal unggah tidak dicatat, jadi ini per posting. */
    public function labelingDaily(): JsonResponse
    {
        $rows = DB::table('posts')
            ->selectRaw("to_char(posted_at, 'YYYY-MM-DD') as day, coalesce(label_manual, 'unlabeled') as label, count(*) as total")
            ->groupBy('day', 'label')
            ->orderBy('day')
            ->get();

        $days = [];
        foreach ($rows as $row) {
            $days[$row->day] ??= ['day' => $row->day, 'organic' => 0, 'anomalous' => 0, 'unlabeled' => 0];
            $days[$row->day][$row->label] = (int) $row->total;
        }

        return response()->json(['data' => array_values($days)]);
    }

    /** `GET /replay/scenarios/{scenario}/composition`: komposisi baris skenario (baseline/incident, label manual). */
    public function replayComposition(ReplayScenario $scenario): JsonResponse
    {
        $rows = DB::table('replay_rows')->where('scenario_id', $scenario->id)
            ->selectRaw("phase, coalesce(label_manual, 'unlabeled') as label, count(*) as total")
            ->groupBy('phase', 'label')
            ->get();

        $phases = ['baseline' => 0, 'incident' => 0];
        $labels = ['organic' => 0, 'anomalous' => 0, 'unlabeled' => 0];
        foreach ($rows as $row) {
            $phases[$row->phase] = ($phases[$row->phase] ?? 0) + (int) $row->total;
            $labels[$row->label] = ($labels[$row->label] ?? 0) + (int) $row->total;
        }

        return response()->json(['data' => [
            'total' => array_sum($phases),
            'phases' => $phases,
            'labels' => $labels,
        ]]);
    }

    /** `GET /topics/coverage`: berapa posting yang cocok dengan topik, dan per topik. */
    public function topicCoverage(): JsonResponse
    {
        $postsTotal = (int) DB::table('posts')->count();
        $postsMatched = (int) DB::table('topic_matches')->distinct('post_id')->count('post_id');

        $perTopic = DB::table('topic_matches')
            ->select('topic_id', DB::raw('count(*) as matched_posts'))
            ->groupBy('topic_id')
            ->pluck('matched_posts', 'topic_id');

        $topics = Topic::orderBy('name')->get(['id', 'name', 'is_active'])->map(fn (Topic $topic) => [
            'id' => $topic->id,
            'name' => $topic->name,
            'is_active' => $topic->is_active,
            'matched_posts' => (int) ($perTopic[$topic->id] ?? 0),
        ]);

        return response()->json(['data' => [
            'posts_total' => $postsTotal,
            'posts_matched' => $postsMatched,
            'topics' => $topics,
        ]]);
    }

    /**
     * `GET /replay/scenarios/{scenario}/series?until=`: jumlah posting run terakhir per menit data (posted_at),
     * sampai `until` (jam data). Dipakai grafik replay yang tumbuh selama Replay berjalan.
     */
    public function replaySeries(Request $request, ReplayScenario $scenario): JsonResponse
    {
        $filters = $request->validate(['until' => 'nullable|date']);

        $rows = DB::table('posts')
            ->where('external_id', 'like', "replay:{$scenario->id}:{$scenario->run_number}:%")
            ->when($filters['until'] ?? null, fn ($q, $until) => $q->where('posted_at', '<=', $until))
            ->selectRaw("date_trunc('minute', posted_at) as t, count(*) as total")
            ->groupBy('t')
            ->orderBy('t')
            ->get();

        return response()->json(['data' => [
            'run' => $scenario->run_number,
            'points' => $rows->map(fn ($row) => [
                't' => CarbonImmutable::parse($row->t)->utc()->toIso8601String(),
                'count' => (int) $row->total,
            ]),
        ]]);
    }
}
