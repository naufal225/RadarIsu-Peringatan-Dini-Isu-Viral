<?php

namespace App\Services\Evaluation;

/**
 * Account-level precision, recall and F1 (PRD §15). Pure: no database access.
 *
 * Only labeled accounts are counted. An account is a real positive when it has at least one
 * `anomalous` post, so a mixed account counts as anomalous (OPEN_QUESTIONS #35).
 */
class EvaluationCalculator
{
    /** Notes recorded in `evaluation_runs.notes` as comma-separated codes. */
    public const NOTE_NO_LABELED_ACCOUNTS = 'no_labeled_accounts';

    public const NOTE_NO_PREDICTED_POSITIVE = 'no_predicted_positive';

    public const NOTE_NO_ACTUAL_POSITIVE = 'no_actual_positive';

    public const NOTE_MIXED_LABEL_ACCOUNTS = 'mixed_label_accounts';

    /**
     * @param  array<int, bool>  $truth  labeled account id => has at least one anomalous post
     * @param  list<int>  $predicted  ids of accounts flagged by an issue alert (labeled or not)
     * @param  int  $mixedAccounts  labeled accounts carrying both labels, for the note only
     * @return array{tp: int, fp: int, fn: int, precision: float, recall: float, f1: float, notes: list<string>}
     */
    public function calculate(array $truth, array $predicted, int $mixedAccounts = 0): array
    {
        $flagged = array_flip($predicted);
        $tp = $fp = $fn = 0;
        foreach ($truth as $accountId => $anomalous) {
            $isFlagged = isset($flagged[$accountId]);
            if ($isFlagged && $anomalous) {
                $tp++;
            } elseif ($isFlagged) {
                $fp++;
            } elseif ($anomalous) {
                $fn++;
            }
        }

        $notes = [];
        if ($truth === []) {
            $notes[] = self::NOTE_NO_LABELED_ACCOUNTS;
        }
        if ($tp + $fp === 0) {
            $notes[] = self::NOTE_NO_PREDICTED_POSITIVE;
        }
        if ($tp + $fn === 0) {
            $notes[] = self::NOTE_NO_ACTUAL_POSITIVE;
        }
        if ($mixedAccounts > 0) {
            $notes[] = self::NOTE_MIXED_LABEL_ACCOUNTS.':'.$mixedAccounts;
        }

        // A zero denominator gives 0 rather than an error; the note says why.
        $precision = $tp + $fp > 0 ? $tp / ($tp + $fp) : 0.0;
        $recall = $tp + $fn > 0 ? $tp / ($tp + $fn) : 0.0;
        $f1 = $precision + $recall > 0 ? 2 * $precision * $recall / ($precision + $recall) : 0.0;

        return [
            'tp' => $tp, 'fp' => $fp, 'fn' => $fn,
            'precision' => round($precision, 4), 'recall' => round($recall, 4), 'f1' => round($f1, 4),
            'notes' => $notes,
        ];
    }
}
