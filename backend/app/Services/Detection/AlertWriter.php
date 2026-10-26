<?php

namespace App\Services\Detection;

use App\Models\Alert;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Creates or refreshes the open alert of a subject (PRD §10.9): the `issue` alert of a topic, or the
 * `impersonation` alert of an account. Detectors hand it a score and evidence; it never changes
 * `status`, never writes `alert_actions`, and never opens a second alert for the same subject.
 *
 *  - One open alert per subject is guaranteed by the partial unique indexes `alerts_open_issue_uq` and
 *    `alerts_open_impersonation_uq`; the upsert targets the index, so two overlapping runs cannot both insert.
 *  - Evidence is deduplicated by `alert_evidence_dedup_uq`; re-attaching it is a no-op. Evidence whose
 *    numbers change from run to run (`$refreshReasons`) is updated in place instead, and rows of that
 *    reason that are no longer true are removed.
 *  - `cooldown_minutes` (settings, not in the PRD) holds off a new alert for a subject whose last alert
 *    was just resolved. It is measured on the wall clock because resolving is a human action.
 */
class AlertWriter
{
    public const OUTCOME_CREATED = 'created';

    public const OUTCOME_UPDATED = 'updated';

    public const OUTCOME_COOLDOWN = 'cooldown';

    /** kind => column holding the subject. The values are interpolated into SQL, so they are fixed here. */
    private const SUBJECT_COLUMN = ['issue' => 'topic_id', 'impersonation' => 'subject_account_id'];

    /**
     * @param  array{score: int, severity: string, score_breakdown: array<string, mixed>}  $scored  ThreatScorer result
     * @param  list<array{reason: string, post_id?: int|null, account_id?: int|null, detail?: array<string, mixed>}>  $evidence
     * @param  array<string, int>  $evidenceLimits  max rows per reason on one alert, e.g. ['spike_sample' => 10]
     * @return array{outcome: string, alert_id: int|null, evidence_added: int}
     */
    public function upsertIssue(
        int $topicId,
        array $scored,
        CarbonInterface $windowStart,
        CarbonInterface $windowEnd,
        CarbonInterface $detectedAt,
        array $evidence,
        int $cooldownMinutes,
        array $evidenceLimits = [],
    ): array {
        return $this->upsert('issue', $topicId, $scored, $windowStart, $windowEnd, $detectedAt, $evidence, $cooldownMinutes, $evidenceLimits, []);
    }

    /**
     * @param  array{score: int, severity: string, score_breakdown: array<string, mixed>}  $scored
     * @param  list<array{reason: string, post_id?: int|null, account_id?: int|null, detail?: array<string, mixed>}>  $evidence
     * @param  list<string>  $refreshReasons  reasons whose rows are rewritten each run
     * @return array{outcome: string, alert_id: int|null, evidence_added: int}
     */
    public function upsertImpersonation(
        int $subjectAccountId,
        array $scored,
        CarbonInterface $windowStart,
        CarbonInterface $windowEnd,
        CarbonInterface $detectedAt,
        array $evidence,
        int $cooldownMinutes,
        array $refreshReasons = ['name_similarity', 'young_account'],
    ): array {
        return $this->upsert('impersonation', $subjectAccountId, $scored, $windowStart, $windowEnd, $detectedAt, $evidence, $cooldownMinutes, [], $refreshReasons);
    }

    /**
     * @param  array<string, mixed>  $scored
     * @param  list<array<string, mixed>>  $evidence
     * @param  array<string, int>  $limits
     * @param  list<string>  $refreshReasons
     * @return array{outcome: string, alert_id: int|null, evidence_added: int}
     */
    private function upsert(string $kind, int $subjectId, array $scored, CarbonInterface $windowStart, CarbonInterface $windowEnd, CarbonInterface $detectedAt, array $evidence, int $cooldownMinutes, array $limits, array $refreshReasons): array
    {
        $column = self::SUBJECT_COLUMN[$kind];

        return DB::transaction(function () use ($kind, $column, $subjectId, $scored, $windowStart, $windowEnd, $detectedAt, $evidence, $cooldownMinutes, $limits, $refreshReasons) {
            if ($this->inCooldown($kind, $column, $subjectId, $cooldownMinutes)) {
                return ['outcome' => self::OUTCOME_COOLDOWN, 'alert_id' => null, 'evidence_added' => 0];
            }

            $now = now()->utc()->format('Y-m-d H:i:s.u').'+00';
            $row = DB::selectOne(<<<SQL
                INSERT INTO alerts
                    (kind, {$column}, score, severity, score_breakdown, status,
                     detected_at, window_start, window_end, created_at, updated_at)
                VALUES ('{$kind}', ?, ?, ?, ?::jsonb, 'new', ?::timestamptz, ?::timestamptz, ?::timestamptz, ?::timestamptz, ?::timestamptz)
                ON CONFLICT ({$column}) WHERE kind = '{$kind}' AND status IN ('new', 'reviewing', 'escalated', 'returned')
                DO UPDATE SET
                    score = EXCLUDED.score,
                    severity = EXCLUDED.severity,
                    score_breakdown = EXCLUDED.score_breakdown,
                    window_end = GREATEST(alerts.window_end, EXCLUDED.window_end),
                    updated_at = EXCLUDED.updated_at
                RETURNING id, (xmax = 0) AS inserted
                SQL, [
                $subjectId,
                $scored['score'],
                $scored['severity'],
                json_encode($scored['score_breakdown'], JSON_THROW_ON_ERROR),
                $this->timestamp($detectedAt),
                $this->timestamp($windowStart),
                $this->timestamp($windowEnd),
                $now,
                $now,
            ]);

            $alertId = (int) $row->id;

            return [
                'outcome' => $row->inserted ? self::OUTCOME_CREATED : self::OUTCOME_UPDATED,
                'alert_id' => $alertId,
                'evidence_added' => $this->attachEvidence($alertId, $evidence, $limits, $refreshReasons, $now),
            ];
        });
    }

    private function inCooldown(string $kind, string $column, int $subjectId, int $cooldownMinutes): bool
    {
        if ($cooldownMinutes <= 0) {
            return false;
        }

        $alerts = Alert::query()->where('kind', $kind)->where($column, $subjectId);

        if ((clone $alerts)->whereIn('status', Alert::OPEN_STATUSES)->exists()) {
            return false; // an open alert is refreshed, never held back
        }

        // approved stamps decided_at, false_positive/closed stamp closed_at (AlertStateMachine).
        return (clone $alerts)
            ->whereIn('status', Alert::TERMINAL_STATUSES)
            ->whereRaw('COALESCE(closed_at, decided_at, updated_at) > ?', [now()->subMinutes($cooldownMinutes)])
            ->exists();
    }

    /**
     * @param  list<array<string, mixed>>  $evidence
     * @param  array<string, int>  $limits
     * @param  list<string>  $refreshReasons
     */
    private function attachEvidence(int $alertId, array $evidence, array $limits, array $refreshReasons, string $now): int
    {
        $rows = [];
        $refresh = [];
        $taken = [];
        $existing = DB::table('alert_evidence')->where('alert_id', $alertId)
            ->selectRaw('reason, count(*) as total')->groupBy('reason')->pluck('total', 'reason');

        foreach ($evidence as $item) {
            $reason = $item['reason'];
            $row = [
                'alert_id' => $alertId,
                'post_id' => $item['post_id'] ?? null,
                'account_id' => $item['account_id'] ?? null,
                'reason' => $reason,
                'detail' => json_encode($item['detail'] ?? [], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ];

            if (in_array($reason, $refreshReasons, true)) {
                $refresh[] = $row;

                continue;
            }
            if (isset($limits[$reason]) && ($existing[$reason] ?? 0) + ($taken[$reason] ?? 0) >= $limits[$reason]) {
                continue;
            }
            $taken[$reason] = ($taken[$reason] ?? 0) + 1;
            $rows[] = $row;
        }

        // ON CONFLICT DO NOTHING on alert_evidence_dedup_uq: already attached evidence is skipped.
        $added = $rows === [] ? 0 : DB::table('alert_evidence')->insertOrIgnore($rows);

        return $added + $this->refreshEvidence($alertId, $refresh, $refreshReasons);
    }

    /**
     * Rewrites the evidence of the refreshed reasons: rows that still hold are updated in place (ids
     * stay), new ones are inserted, and rows that no longer hold are deleted.
     *
     * @param  list<array<string, mixed>>  $rows
     * @param  list<string>  $reasons
     */
    private function refreshEvidence(int $alertId, array $rows, array $reasons): int
    {
        if ($reasons === []) {
            return 0;
        }

        $keep = [];
        $added = 0;
        foreach ($rows as $row) {
            $saved = DB::selectOne(<<<'SQL'
                INSERT INTO alert_evidence (alert_id, post_id, account_id, reason, detail, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?::jsonb, ?::timestamptz, ?::timestamptz)
                ON CONFLICT (alert_id, reason, (COALESCE(post_id, 0)), (COALESCE(account_id, 0)))
                DO UPDATE SET detail = EXCLUDED.detail, updated_at = EXCLUDED.updated_at
                RETURNING id, (xmax = 0) AS inserted
                SQL, [$row['alert_id'], $row['post_id'], $row['account_id'], $row['reason'], $row['detail'], $row['created_at'], $row['updated_at']]);
            $keep[] = (int) $saved->id;
            $added += $saved->inserted ? 1 : 0;
        }

        DB::table('alert_evidence')->where('alert_id', $alertId)->whereIn('reason', $reasons)->whereNotIn('id', $keep)->delete();

        return $added;
    }

    private function timestamp(CarbonInterface $at): string
    {
        return $at->copy()->utc()->format('Y-m-d H:i:s.u').'+00';
    }
}
