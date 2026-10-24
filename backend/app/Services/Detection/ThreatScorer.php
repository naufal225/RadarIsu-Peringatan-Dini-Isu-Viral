<?php

namespace App\Services\Detection;

/**
 * Pure service for calculating threat scores and breakdowns (F7, Domain C).
 * Conforms to PRD §10.7, §10.8 and docs/CONTRACTS.md §3.3 & §4.
 *
 * All functions are pure: no database access, no current time (now()), fully deterministic.
 */
class ThreatScorer
{
    public const DEFAULT_WEIGHTS = [
        'spike' => 40,
        'anomaly' => 30,
        'sentiment' => 20,
        'reach' => 10,
    ];

    public const DEFAULT_SEVERITY_CUTOFFS = [
        'medium' => 40,
        'high' => 70,
    ];

    public const DEFAULT_Z_THRESHOLD = 3.0;
    public const DEFAULT_Z_DIVISOR = 6.0;
    public const DEFAULT_IMPERSONATION_THRESHOLD = 0.6;

    /**
     * Compute threat score and breakdown for an 'issue' alert (PRD §10.8).
     *
     * Formula:
     *   spike     = min(z / 6, 1)                       * weights.spike (0 if baseline not sufficient)
     *   anomaly   = min(anomalous / unique_accounts, 1) * weights.anomaly
     *   sentiment = (negative / volume)                 * weights.sentiment
     *   reach     = min(source_count / active_sources, 1) * weights.reach
     *   score     = round(spike + anomaly + sentiment + reach) # 0–100
     *   severity  = high if >= cutoffs.high; medium if >= cutoffs.medium; else low
     *
     * @param array{
     *     z?: float|int,
     *     spike_z?: float|int,
     *     has_sufficient_baseline?: bool,
     *     anomalous_accounts?: int,
     *     unique_accounts?: int,
     *     anomaly_ratio?: float|int,
     *     negative_posts?: int,
     *     total_posts?: int,
     *     sentiment_ratio?: float|int,
     *     source_count?: int,
     *     active_sources?: int,
     *     reach_ratio?: float|int,
     * } $input
     * @param array{
     *     weights?: array{spike?: float|int, anomaly?: float|int, sentiment?: float|int, reach?: float|int},
     *     severity_cutoffs?: array{medium?: int, high?: int},
     *     z_threshold?: float|int,
     *     z_divisor?: float|int,
     * } $options
     * @return array{
     *     score: int,
     *     severity: string,
     *     score_breakdown: array{
     *         spike: array{raw: float, weight: int|float, value: float},
     *         anomaly: array{raw: float, weight: int|float, value: float},
     *         sentiment: array{raw: float, weight: int|float, value: float},
     *         reach: array{raw: float, weight: int|float, value: float},
     *         thresholds: array{z: float|int, severity_medium: int, severity_high: int}
     *     },
     *     breakdown: array
     * }
     */
    public static function score(array $input, array $options = []): array
    {
        return static::scoreIssue($input, $options);
    }

    /**
     * Explicit scorer for issue alerts.
     */
    public static function scoreIssue(array $input, array $options = []): array
    {
        $weights = array_merge(self::DEFAULT_WEIGHTS, $options['weights'] ?? []);
        $cutoffs = array_merge(self::DEFAULT_SEVERITY_CUTOFFS, $options['severity_cutoffs'] ?? []);
        $zDivisor = (float) ($options['z_divisor'] ?? self::DEFAULT_Z_DIVISOR);
        if ($zDivisor <= 0.0) {
            $zDivisor = self::DEFAULT_Z_DIVISOR;
        }
        $zThreshold = $options['z_threshold'] ?? self::DEFAULT_Z_THRESHOLD;

        // 1. Spike component
        $z = (float) ($input['z'] ?? $input['spike_z'] ?? 0.0);
        $hasBaseline = (bool) ($input['has_sufficient_baseline'] ?? true);
        $rawSpike = max(0.0, $z);

        if ($hasBaseline) {
            $spikeRatio = min($rawSpike / $zDivisor, 1.0);
            $spikeValue = $spikeRatio * (float) $weights['spike'];
        } else {
            $spikeValue = 0.0;
        }

        // 2. Anomaly component
        if (isset($input['anomaly_ratio'])) {
            $rawAnomaly = (float) $input['anomaly_ratio'];
        } else {
            $anomalous = (float) ($input['anomalous_accounts'] ?? 0);
            $uniqueAccounts = (float) ($input['unique_accounts'] ?? 0);
            $rawAnomaly = ($uniqueAccounts > 0.0) ? ($anomalous / $uniqueAccounts) : 0.0;
        }
        $rawAnomaly = max(0.0, $rawAnomaly);
        $anomalyRatio = min($rawAnomaly, 1.0);
        $anomalyValue = $anomalyRatio * (float) $weights['anomaly'];

        // 3. Sentiment component
        if (isset($input['sentiment_ratio'])) {
            $rawSentiment = (float) $input['sentiment_ratio'];
        } else {
            $negative = (float) ($input['negative_posts'] ?? 0);
            $volume = (float) ($input['total_posts'] ?? 0);
            $rawSentiment = ($volume > 0.0) ? ($negative / $volume) : 0.0;
        }
        $rawSentiment = max(0.0, $rawSentiment);
        $sentimentRatio = min($rawSentiment, 1.0);
        $sentimentValue = $sentimentRatio * (float) $weights['sentiment'];

        // 4. Reach component
        if (isset($input['reach_ratio'])) {
            $rawReach = (float) $input['reach_ratio'];
        } else {
            $sourceCount = (float) ($input['source_count'] ?? 0);
            $activeSources = (float) ($input['active_sources'] ?? 0);
            $rawReach = ($activeSources > 0.0) ? ($sourceCount / $activeSources) : 0.0;
        }
        $rawReach = max(0.0, $rawReach);
        $reachRatio = min($rawReach, 1.0);
        $reachValue = $reachRatio * (float) $weights['reach'];

        // Aggregate score (0–100)
        $totalRawScore = $spikeValue + $anomalyValue + $sentimentValue + $reachValue;
        $score = (int) max(0, min(100, (int) round($totalRawScore)));

        // Determine severity
        $severity = static::determineSeverity($score, $cutoffs);

        $breakdown = [
            'spike' => [
                'raw' => round($rawSpike, 3),
                'weight' => $weights['spike'],
                'value' => round($spikeValue, 2),
            ],
            'anomaly' => [
                'raw' => round($rawAnomaly, 3),
                'weight' => $weights['anomaly'],
                'value' => round($anomalyValue, 2),
            ],
            'sentiment' => [
                'raw' => round($rawSentiment, 3),
                'weight' => $weights['sentiment'],
                'value' => round($sentimentValue, 2),
            ],
            'reach' => [
                'raw' => round($rawReach, 3),
                'weight' => $weights['reach'],
                'value' => round($reachValue, 2),
            ],
            'thresholds' => [
                'z' => $zThreshold,
                'severity_medium' => (int) $cutoffs['medium'],
                'severity_high' => (int) $cutoffs['high'],
            ],
        ];

        return [
            'score' => $score,
            'severity' => $severity,
            'score_breakdown' => $breakdown,
            'breakdown' => $breakdown,
        ];
    }

    /**
     * Compute threat score and breakdown for an 'impersonation' alert (PRD §10.7).
     *
     * Formula:
     *   score = round(similarity * 70) + (is_young_account ? 30 : 0)
     *   severity determined by same cutoffs (high >= 70, medium >= 40, else low)
     *
     * @param float $similarity Similarity score [0.0 - 1.0]
     * @param bool $isYoungAccount Whether the account was created recently
     * @param array $options
     * @return array
     */
    public static function scoreImpersonation(float $similarity, bool $isYoungAccount, array $options = []): array
    {
        $cutoffs = array_merge(self::DEFAULT_SEVERITY_CUTOFFS, $options['severity_cutoffs'] ?? []);
        $impersonationThreshold = (float) ($options['impersonation_threshold'] ?? self::DEFAULT_IMPERSONATION_THRESHOLD);

        $clampedSimilarity = max(0.0, min(1.0, $similarity));
        $simValue = round($clampedSimilarity * 70.0, 2);
        $youngValue = $isYoungAccount ? 30.0 : 0.0;

        $score = (int) max(0, min(100, (int) round($simValue + $youngValue)));
        $severity = static::determineSeverity($score, $cutoffs);

        $breakdown = [
            'similarity' => [
                'raw' => round($clampedSimilarity, 3),
                'weight' => 70,
                'value' => round($simValue, 2),
            ],
            'young_account' => [
                'raw' => $isYoungAccount ? 1.0 : 0.0,
                'weight' => 30,
                'value' => $youngValue,
            ],
            'thresholds' => [
                'impersonation_threshold' => $impersonationThreshold,
                'severity_medium' => (int) $cutoffs['medium'],
                'severity_high' => (int) $cutoffs['high'],
            ],
        ];

        return [
            'score' => $score,
            'severity' => $severity,
            'score_breakdown' => $breakdown,
            'breakdown' => $breakdown,
        ];
    }

    /**
     * Determine severity level ('low', 'medium', 'high') based on score and cutoffs.
     *
     * @param int $score
     * @param array{medium: int|float, high: int|float} $cutoffs
     * @return string 'low'|'medium'|'high'
     */
    public static function determineSeverity(int $score, array $cutoffs = self::DEFAULT_SEVERITY_CUTOFFS): string
    {
        if ($score >= (int) ($cutoffs['high'] ?? self::DEFAULT_SEVERITY_CUTOFFS['high'])) {
            return 'high';
        }

        if ($score >= (int) ($cutoffs['medium'] ?? self::DEFAULT_SEVERITY_CUTOFFS['medium'])) {
            return 'medium';
        }

        return 'low';
    }
}
