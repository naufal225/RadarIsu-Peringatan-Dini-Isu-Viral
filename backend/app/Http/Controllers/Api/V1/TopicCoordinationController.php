<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Models\Topic;
use App\Services\Detection\CoordinationDetectionService;
use App\Services\Detection\DataClock;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * What the coordination detector sees in a topic right now (F4): the clusters of near-identical posts,
 * the accounts in them, and the numbers behind each flag. Read-only; it writes no alert and no metric.
 *
 * Restricted to `alerts.triage` (analysts): it names accounts and quotes their posts before any alert
 * has been escalated to a leader, so `topics.view` is not enough.
 */
class TopicCoordinationController extends Controller
{
    /** Accounts listed per cluster; the count is always the full one. */
    private const ACCOUNT_LIST_LIMIT = 100;

    private const TEXT_LIMIT = 280;

    public function __invoke(Topic $topic, CoordinationDetectionService $coordination): JsonResponse
    {
        $now = DataClock::now();
        $result = $coordination->detect(collect([$topic]), $now, Setting::detection())[$topic->id];

        $accountIds = collect($result['clusters'])->flatMap(fn ($c) => array_slice(array_keys($c['accounts']), 0, self::ACCOUNT_LIST_LIMIT))->unique()->all();
        $handles = DB::table('accounts')->whereIn('id', $accountIds)->pluck('handle', 'id');
        $texts = DB::table('posts')->whereIn('id', array_column($result['clusters'], 'seed_post_id'))->pluck('text', 'id');

        return response()->json(['data' => [
            'topic_id' => $topic->id,
            'as_of' => $now->toIso8601ZuluString(),
            'triggered' => $result['triggered'],
            'window' => $result['window'],
            'posts_in_window' => $result['posts_in_window'],
            'accounts_in_window' => $result['accounts_in_window'],
            'truncated' => $result['truncated'],
            'thresholds' => $result['thresholds'],
            'clusters' => array_map(fn ($cluster) => [
                'cluster_id' => $cluster['cluster_id'],
                'accounts_count' => $cluster['accounts_count'],
                'posts_count' => $cluster['posts_count'],
                'similarity_min' => $cluster['similarity_min'],
                'similarity_max' => $cluster['similarity_max'],
                'from' => CarbonImmutable::createFromTimestampUTC($cluster['from'])->toIso8601ZuluString(),
                'to' => CarbonImmutable::createFromTimestampUTC($cluster['to'])->toIso8601ZuluString(),
                'synchronized' => $cluster['synchronized'],
                'sample_text' => Str::limit((string) ($texts[$cluster['seed_post_id']] ?? ''), self::TEXT_LIMIT),
                'accounts' => collect($cluster['accounts'])->take(self::ACCOUNT_LIST_LIMIT)->map(fn ($account, $id) => [
                    'id' => $id,
                    'handle' => $handles[$id] ?? null,
                    'similarity' => $account['similarity'],
                    'young' => $account['young'],
                    'age_days' => $account['age_days'],
                    'synchronized' => $account['synchronized'],
                    'posts_count' => $account['posts_count'],
                ])->values()->all(),
            ], $result['clusters']),
        ]]);
    }
}
