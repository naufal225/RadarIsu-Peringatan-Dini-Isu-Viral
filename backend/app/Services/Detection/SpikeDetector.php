<?php

namespace App\Services\Detection;

/**
 * Spike decision for one topic (F3, PRD §10.5). Pure: no database, no clock, thresholds come in as
 * arguments, so every branch is unit-testable (CONTRACTS §4).
 *
 *   z     = (current_rate - mean) / max(std, 1)
 *   z_eff = max(2.0, z_threshold + sensitivity_z_offset[topic sensitivity])
 *   fires = z >= z_eff AND current >= min_volume, once the baseline has min_baseline_hours of history
 *
 * `max(std, 1)` keeps a flat or empty baseline from turning one extra post into an enormous z, and
 * `min_volume` keeps a quiet topic (2 → 6 posts) from firing at all.
 */
class SpikeDetector
{
    /** Lowest threshold whatever the offset (PRD §10.5 step 4). */
    public const MIN_EFFECTIVE_Z = 2.0;

    public const STATUS_TRIGGERED = 'triggered';

    public const STATUS_BELOW_THRESHOLD = 'below_threshold';

    public const STATUS_BELOW_MIN_VOLUME = 'below_min_volume';

    public const STATUS_INSUFFICIENT_BASELINE = 'insufficient_baseline';

    /**
     * @param  int  $current  posts matching the topic inside the current window
     * @param  list<int|float>  $baseline  hourly volumes of the history before the running hour, oldest first, hours without posts as 0
     * @param  array<string, mixed>  $settings  Setting::detection()
     * @param  string  $sensitivity  topic sensitivity: low|medium|high
     * @return array{
     *     triggered: bool, status: string, has_sufficient_baseline: bool,
     *     current: int, current_rate: float, mean: float, std: float, z: float, z_effective: float,
     *     baseline_hours: int, threshold_rate: float,
     *     thresholds: array<string, int|float|string>
     * }
     */
    public static function evaluate(int $current, array $baseline, array $settings, string $sensitivity): array
    {
        $windowMinutes = max(1, (int) $settings['spike_current_window_minutes']);
        $offset = (float) ($settings['sensitivity_z_offset'][$sensitivity] ?? 0.0);
        $zEffective = max(self::MIN_EFFECTIVE_Z, (float) $settings['z_threshold'] + $offset);

        $hours = count($baseline);
        $hasBaseline = $hours >= (int) $settings['min_baseline_hours'];

        $mean = $hours > 0 ? array_sum($baseline) / $hours : 0.0;
        $variance = $hours > 0
            ? array_sum(array_map(static fn ($volume) => ($volume - $mean) ** 2, $baseline)) / $hours
            : 0.0;
        $std = sqrt($variance);

        // Baseline is posts per hour; a window of another length is scaled to the same unit.
        $currentRate = $current * 60 / $windowMinutes;
        $divisor = max($std, 1.0);
        $z = $hasBaseline ? ($currentRate - $mean) / $divisor : 0.0;

        $status = match (true) {
            ! $hasBaseline => self::STATUS_INSUFFICIENT_BASELINE,
            $z < $zEffective => self::STATUS_BELOW_THRESHOLD,
            $current < (int) $settings['min_volume'] => self::STATUS_BELOW_MIN_VOLUME,
            default => self::STATUS_TRIGGERED,
        };

        return [
            'triggered' => $status === self::STATUS_TRIGGERED,
            'status' => $status,
            'has_sufficient_baseline' => $hasBaseline,
            'current' => $current,
            'current_rate' => round($currentRate, 3),
            'mean' => round($mean, 3),
            'std' => round($std, 3),
            'z' => round($z, 3),
            'z_effective' => round($zEffective, 3),
            'baseline_hours' => $hours,
            // Posts per hour at which z reaches z_effective; the line drawn on the topic chart.
            'threshold_rate' => round($mean + $zEffective * $divisor, 3),
            'thresholds' => [
                'z_threshold' => (float) $settings['z_threshold'],
                'sensitivity' => $sensitivity,
                'sensitivity_z_offset' => $offset,
                'z_effective' => round($zEffective, 3),
                'min_volume' => (int) $settings['min_volume'],
                'min_baseline_hours' => (int) $settings['min_baseline_hours'],
                'baseline_window_hours' => (int) $settings['baseline_hours'],
                'current_window_minutes' => $windowMinutes,
            ],
        ];
    }
}
