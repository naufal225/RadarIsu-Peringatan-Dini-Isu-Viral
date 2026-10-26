<?php

namespace App\Services\Detection;

use App\Models\Alert;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Creates or refreshes the open `issue` alert of a topic (PRD §10.9). Detectors hand it a score and
 * evidence; it never changes `status`, never writes `alert_actions`, and never opens a second alert.
 *
 *  - One open alert per topic is guaranteed by the partial unique index `alerts_open_issue_uq`; the
 *    upsert targets that index, so two overlapping runs cannot both insert.
 *  - Evidence is deduplicated by `alert_evidence_dedup_uq`; re-attaching it is a no-op.
 *  - `cooldown_minutes` (settings, not in the PRD) holds off a new alert for a topic whose last alert
 *    was just resolved. It is measured on the wall clock because resolving is a human action.
 */
class AlertWriter
{
    public const OUTCOME_CREATED = 'created';

    public const OUTCOME_UPDATED = 'updated';

    public const OUTCOME_COOLDOWN = 'cooldown';

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
        return DB::transaction(function () use ($topicId, $scored, $windowStart, $windowEnd, $detectedAt, $evidence, $cooldownMinutes, $evidenceLimits) {
            if ($this->inCooldown($topicId, $cooldownMinutes)) {
                return ['outcome' => self::OUTCOME_COOLDOWN, 'alert_id' => null, 'evidence_added' => 0];
            }

            $now = now()->utc()->format('Y-m-d H:i:s.u').'+00';
            $row = DB::selectOne(<<<'SQL'
                INSERT INTO alerts
                    (kind, topic_id, score, severity, score_breakdown, status,
                     detected_at, window_start, window_end, created_at, updated_at)
                VALUES ('issue', ?, ?, ?, ?::jsonb, 'new', ?::timestamptz, ?::timestamptz, ?::timestamptz, ?::timestamptz, ?::timestamptz)
                ON CONFLICT (topic_id) WHERE kind = 'issue' AND status IN ('new', 'reviewing', 'escalated', 'returned')
                DO UPDATE SET
                    score = EXCLUDED.score,
                    severity = EXCLUDED.severity,
                    score_breakdown = EXCLUDED.score_breakdown,
                    window_end = GREATEST(alerts.window_end, EXCLUDED.window_end),
                    updated_at = EXCLUDED.updated_at
                RETURNING id, (xmax = 0) AS inserted
                SQL, [
                $topicId,
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
                'evidence_added' => $this->attachEvidence($alertId, $evidence, $evidenceLimits, $now),
            ];
        });
    }

    private function inCooldown(int $topicId, int $cooldownMinutes): bool
    {
        if ($cooldownMinutes <= 0) {
            return false;
        }

        $issues = Alert::query()->where('kind', 'issue')->where('topic_id', $topicId);

        if ((clone $issues)->whereIn('status', Alert::OPEN_STATUSES)->exists()) {
            return false; // an open alert is refreshed, never held back
        }

        // approved stamps decided_at, false_positive/closed stamp closed_at (AlertStateMachine).
        return (clone $issues)
            ->whereIn('status', Alert::TERMINAL_STATUSES)
            ->whereRaw('COALESCE(closed_at, decided_at, updated_at) > ?', [now()->subMinutes($cooldownMinutes)])
            ->exists();
    }

    /**
     * @param  list<array<string, mixed>>  $evidence
     * @param  array<string, int>  $limits
     */
    private function attachEvidence(int $alertId, array $evidence, array $limits, string $now): int
    {
        $rows = [];
        $taken = [];
        $existing = DB::table('alert_evidence')->where('alert_id', $alertId)
            ->selectRaw('reason, count(*) as total')->groupBy('reason')->pluck('total', 'reason');

        foreach ($evidence as $item) {
            $reason = $item['reason'];
            if (isset($limits[$reason]) && ($existing[$reason] ?? 0) + ($taken[$reason] ?? 0) >= $limits[$reason]) {
                continue;
            }
            $taken[$reason] = ($taken[$reason] ?? 0) + 1;
            $rows[] = [
                'alert_id' => $alertId,
                'post_id' => $item['post_id'] ?? null,
                'account_id' => $item['account_id'] ?? null,
                'reason' => $reason,
                'detail' => json_encode($item['detail'] ?? [], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        // ON CONFLICT DO NOTHING on alert_evidence_dedup_uq: already attached evidence is skipped.
        return $rows === [] ? 0 : DB::table('alert_evidence')->insertOrIgnore($rows);
    }

    private function timestamp(CarbonInterface $at): string
    {
        return $at->copy()->utc()->format('Y-m-d H:i:s.u').'+00';
    }
}
