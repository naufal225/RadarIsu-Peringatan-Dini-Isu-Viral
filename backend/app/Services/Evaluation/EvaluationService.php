<?php

namespace App\Services\Evaluation;

use App\Models\EvaluationRun;
use App\Models\ReplayScenario;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Runs one evaluation and stores it in `evaluation_runs` (PRD §15, §9.6).
 *
 * Ground truth: accounts with a manually labeled post. Prediction: accounts that are evidence
 * (`similar_text`, `young_account`, `synchronized_posting`) of an `issue` alert. With a scenario the
 * labeled posts are limited to the scenario's replay source.
 */
class EvaluationService
{
    /** PRD §15: evidence reasons that count as "predicted anomalous". */
    public const PREDICTING_REASONS = ['similar_text', 'young_account', 'synchronized_posting'];

    public function __construct(private EvaluationCalculator $calculator) {}

    public function run(User $user, ?ReplayScenario $scenario = null): EvaluationRun
    {
        $posts = DB::table('posts')->whereNotNull('label_manual');
        if ($scenario !== null) {
            $posts->where('source_id', $scenario->source_id);
        }

        $rows = (clone $posts)
            ->selectRaw("account_id, bool_or(label_manual = 'anomalous') as anomalous, bool_or(label_manual = 'organic') as organic")
            ->groupBy('account_id')->get();
        $truth = [];
        $mixed = 0;
        foreach ($rows as $row) {
            $truth[(int) $row->account_id] = (bool) $row->anomalous;
            $mixed += $row->anomalous && $row->organic ? 1 : 0;
        }
        $labeledPosts = (clone $posts)->count();

        $predicted = $truth === []
            ? []
            : $this->flaggedAccounts(array_keys($truth))->pluck('account_id')->map(fn ($id) => (int) $id)->unique()->values()->all();
        $result = $this->calculator->calculate($truth, $predicted, $mixed);

        $notes = $result['notes'];
        $latency = $this->detectionLatency($scenario, array_keys(array_filter($truth)), $notes);

        return DB::transaction(fn () => EvaluationRun::create([
            'scenario_id' => $scenario?->id,
            'run_by' => $user->id,
            'labeled_posts' => $labeledPosts,
            'tp' => $result['tp'], 'fp' => $result['fp'], 'fn' => $result['fn'],
            'precision' => $result['precision'], 'recall' => $result['recall'], 'f1' => $result['f1'],
            'detection_latency_seconds' => $latency,
            'notes' => $notes === [] ? null : implode(',', $notes),
        ]));
    }

    /**
     * @param  list<int>  $accountIds
     * @return Collection<int, object>
     */
    private function flaggedAccounts(array $accountIds): Collection
    {
        return DB::table('alert_evidence as e')
            ->join('alerts as a', 'a.id', '=', 'e.alert_id')
            ->where('a.kind', 'issue')
            ->whereIn('e.reason', self::PREDICTING_REASONS)
            ->whereIn('e.account_id', $accountIds)
            ->select('e.account_id', 'a.detected_at')
            ->get();
    }

    /**
     * Seconds from the incident start (anchor + offset of the scenario's last run) to the first issue
     * alert that flagged an anomalous account. Null without a scenario, an anchor, or such an alert.
     *
     * @param  list<int>  $anomalousIds
     * @param  list<string>  $notes
     */
    private function detectionLatency(?ReplayScenario $scenario, array $anomalousIds, array &$notes): ?int
    {
        if ($scenario === null || $scenario->virtual_anchor_at === null || $scenario->incident_start_offset_seconds === null) {
            return null;
        }
        $first = $anomalousIds === [] ? null : $this->flaggedAccounts($anomalousIds)->min('detected_at');
        if ($first === null) {
            $notes[] = 'no_detection';

            return null;
        }
        $start = CarbonImmutable::parse($scenario->virtual_anchor_at)->addSeconds($scenario->incident_start_offset_seconds);

        return (int) $start->diffInSeconds(CarbonImmutable::parse($first), false);
    }
}
