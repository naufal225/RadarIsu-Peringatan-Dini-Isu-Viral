<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\LookalikesRequest;
use App\Models\Alert;
use App\Services\Detection\DataClock;
use App\Services\Detection\ImpersonationDetectionService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

/**
 * Accounts that look like an official account right now (F13): what the impersonation detector sees,
 * with the closest official account, the similarity and the rules that fired. Read-only; it writes no alert.
 *
 * Restricted to `alerts.triage` (analysts): it names accounts as suspected impersonators before any alert
 * has been escalated to a leader, so `topics.view` is not enough.
 */
class OfficialAccountLookalikeController extends Controller
{
    public function __invoke(LookalikesRequest $request, ImpersonationDetectionService $detection): JsonResponse
    {
        $scan = $detection->scan($request->officialAccountId());
        $findings = collect($scan['findings']);

        $total = $findings->count();
        $perPage = $request->perPage();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = $findings->forPage($request->page(), $perPage)->values();

        // The open alert of each account on this page, if there is one.
        $alerts = Alert::query()->where('kind', 'impersonation')->whereIn('status', Alert::OPEN_STATUSES)
            ->whereIn('subject_account_id', $page->map(fn ($f) => $f['account']->id)->all())
            ->get(['id', 'status', 'subject_account_id'])->keyBy('subject_account_id');

        return response()->json([
            'data' => $page->map(function ($finding) use ($scan, $alerts) {
                $account = $finding['account'];
                $decision = $finding['decision'];
                $official = $scan['officials'][$decision['official_id']];
                $alert = $alerts[$account->id] ?? null;

                return [
                    'account' => [
                        'id' => $account->id,
                        'handle' => $account->handle,
                        'display_name' => $account->display_name,
                        'first_seen_at' => CarbonImmutable::parse($account->first_seen_at)->toIso8601ZuluString(),
                        'platform_created_at' => $account->platform_created_at === null ? null : CarbonImmutable::parse($account->platform_created_at)->toIso8601ZuluString(),
                    ],
                    'official' => ['id' => $official['id'], 'handle' => $official['handle'], 'display_name' => $official['display_name']],
                    'similarity' => $decision['similarity'],
                    'field' => $decision['field'],
                    'reading' => $decision['variant'],
                    'same_name' => $decision['same_name'],
                    'rules' => $decision['rules'],
                    'other_matches' => array_map(fn ($m) => $m + ['handle' => $scan['officials'][$m['official_id']]['handle']], $decision['other_matches']),
                    'young' => $decision['young'],
                    'age_days' => $decision['age_days'],
                    'alert' => $alert === null ? null : ['id' => $alert->id, 'status' => $alert->status],
                ];
            })->all(),
            'meta' => [
                'current_page' => min($request->page(), $lastPage),
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $total,
                'as_of' => DataClock::now()->toIso8601ZuluString(),
                'window' => $scan['window'],
                'officials_count' => count($scan['officials']),
            ],
        ]);
    }
}
