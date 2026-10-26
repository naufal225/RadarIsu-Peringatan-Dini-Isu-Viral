<?php

namespace Tests\Unit\Detection;

use App\Models\Setting;
use App\Services\Detection\SpikeDetector;
use PHPUnit\Framework\TestCase;

/**
 * PRD §10.5 and §19.3 items 1-2. Pure: no database, no clock.
 */
class SpikeDetectorTest extends TestCase
{
    /** 168 hours of a flat 10 posts/hour. */
    private function flat(int $hours = 168, int $volume = 10): array
    {
        return array_fill(0, $hours, $volume);
    }

    /** @param array<string, mixed> $changes */
    private function settings(array $changes = []): array
    {
        return array_replace(Setting::DETECTION_DEFAULTS, $changes);
    }

    public function test_synthetic_spike_over_a_flat_baseline_fires(): void
    {
        $result = SpikeDetector::evaluate(80, $this->flat(), $this->settings(), 'medium');

        $this->assertTrue($result['triggered']);
        $this->assertSame(SpikeDetector::STATUS_TRIGGERED, $result['status']);
        $this->assertSame(70.0, $result['z']); // (80 - 10) / max(0, 1)
        $this->assertSame(10.0, $result['mean']);
        $this->assertSame(0.0, $result['std']);
        $this->assertSame(168, $result['baseline_hours']);
    }

    public function test_normal_traffic_does_not_fire(): void
    {
        $result = SpikeDetector::evaluate(11, $this->flat(), $this->settings(), 'medium');

        $this->assertFalse($result['triggered']);
        $this->assertSame(SpikeDetector::STATUS_BELOW_THRESHOLD, $result['status']);
    }

    public function test_cold_start_is_skipped_without_error_and_scores_zero_z(): void
    {
        $result = SpikeDetector::evaluate(500, $this->flat(23), $this->settings(), 'medium');

        $this->assertFalse($result['triggered']);
        $this->assertFalse($result['has_sufficient_baseline']);
        $this->assertSame(SpikeDetector::STATUS_INSUFFICIENT_BASELINE, $result['status']);
        $this->assertSame(0.0, $result['z']);
    }

    public function test_baseline_exactly_at_the_minimum_counts(): void
    {
        $result = SpikeDetector::evaluate(80, $this->flat(24), $this->settings(), 'medium');

        $this->assertTrue($result['has_sufficient_baseline']);
        $this->assertTrue($result['triggered']);
    }

    public function test_empty_history_is_insufficient_not_an_error(): void
    {
        $result = SpikeDetector::evaluate(80, [], $this->settings(), 'medium');

        $this->assertSame(SpikeDetector::STATUS_INSUFFICIENT_BASELINE, $result['status']);
        $this->assertSame(0.0, $result['mean']);
        $this->assertSame(0, $result['baseline_hours']);
    }

    public function test_a_small_topic_jumping_from_two_to_six_is_not_a_spike(): void
    {
        $result = SpikeDetector::evaluate(6, $this->flat(168, 2), $this->settings(), 'medium');

        $this->assertGreaterThanOrEqual(3.0, $result['z']); // large relative jump...
        $this->assertFalse($result['triggered']);           // ...but below min_volume (20)
        $this->assertSame(SpikeDetector::STATUS_BELOW_MIN_VOLUME, $result['status']);
    }

    public function test_min_volume_boundary_is_inclusive(): void
    {
        $settings = $this->settings(['min_volume' => 20]);

        $this->assertTrue(SpikeDetector::evaluate(20, $this->flat(168, 2), $settings, 'medium')['triggered']);
        $this->assertFalse(SpikeDetector::evaluate(19, $this->flat(168, 2), $settings, 'medium')['triggered']);
    }

    public function test_std_of_zero_is_floored_at_one(): void
    {
        $result = SpikeDetector::evaluate(14, $this->flat(168, 10), $this->settings(['min_volume' => 1]), 'medium');

        $this->assertSame(4.0, $result['z']); // (14 - 10) / 1, not a division by zero
    }

    public function test_noisy_baseline_needs_a_bigger_jump(): void
    {
        $noisy = [];
        for ($i = 0; $i < 168; $i++) {
            $noisy[] = $i % 2 === 0 ? 0 : 40; // mean 20, std 20
        }

        $this->assertFalse(SpikeDetector::evaluate(60, $noisy, $this->settings(), 'medium')['triggered']); // z = 2.0 < 3
        $this->assertTrue(SpikeDetector::evaluate(90, $noisy, $this->settings(), 'medium')['triggered']);  // z = 3.5
    }

    public function test_sensitivity_moves_the_threshold(): void
    {
        $baseline = [];
        for ($i = 0; $i < 168; $i++) {
            $baseline[] = $i % 2 === 0 ? 0 : 40;
        }
        $settings = $this->settings(); // offsets: low +1, medium 0, high -0.5
        $current = 70;                 // z = 2.5

        $this->assertTrue(SpikeDetector::evaluate($current, $baseline, $settings, 'high')['triggered']);   // z_eff 2.5
        $this->assertFalse(SpikeDetector::evaluate($current, $baseline, $settings, 'medium')['triggered']); // 3.0
        $this->assertFalse(SpikeDetector::evaluate($current, $baseline, $settings, 'low')['triggered']);    // 4.0
        $this->assertSame(2.5, SpikeDetector::evaluate($current, $baseline, $settings, 'high')['z_effective']);
    }

    public function test_effective_z_never_drops_below_two(): void
    {
        $settings = $this->settings(['z_threshold' => 2.0, 'sensitivity_z_offset' => ['low' => 1.0, 'medium' => 0.0, 'high' => -3.0]]);

        $this->assertSame(2.0, SpikeDetector::evaluate(80, $this->flat(), $settings, 'high')['z_effective']);
    }

    public function test_unknown_sensitivity_falls_back_to_no_offset(): void
    {
        $this->assertSame(3.0, SpikeDetector::evaluate(80, $this->flat(), $this->settings(), 'bogus')['z_effective']);
    }

    public function test_a_shorter_window_is_scaled_to_posts_per_hour(): void
    {
        $settings = $this->settings(['spike_current_window_minutes' => 30, 'min_volume' => 1]);

        $result = SpikeDetector::evaluate(40, $this->flat(), $settings, 'medium');

        $this->assertSame(80.0, $result['current_rate']);
        $this->assertSame(70.0, $result['z']);
        $this->assertSame(40, $result['current']); // min_volume still compares the raw count
    }

    public function test_a_quiet_current_window_after_busy_history_is_not_a_spike(): void
    {
        $result = SpikeDetector::evaluate(0, $this->flat(), $this->settings(), 'medium');

        $this->assertFalse($result['triggered']);
        $this->assertSame(-10.0, $result['z']);
    }

    public function test_thresholds_in_use_are_reported_as_evidence(): void
    {
        $result = SpikeDetector::evaluate(80, $this->flat(), $this->settings(['min_volume' => 25]), 'high');

        $this->assertSame([
            'z_threshold' => 3.0,
            'sensitivity' => 'high',
            'sensitivity_z_offset' => -0.5,
            'z_effective' => 2.5,
            'min_volume' => 25,
            'min_baseline_hours' => 24,
            'baseline_window_hours' => 168,
            'current_window_minutes' => 60,
        ], $result['thresholds']);
        $this->assertSame(12.5, $result['threshold_rate']); // mean 10 + 2.5 * max(0, 1)
    }

    public function test_same_inputs_give_the_same_result(): void
    {
        $a = SpikeDetector::evaluate(55, $this->flat(), $this->settings(), 'medium');
        $b = SpikeDetector::evaluate(55, $this->flat(), $this->settings(), 'medium');

        $this->assertSame($a, $b);
    }
}
