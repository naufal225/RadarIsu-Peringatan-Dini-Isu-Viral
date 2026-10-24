<?php

namespace Tests\Unit\Scoring;

use App\Services\Detection\ThreatScorer;
use PHPUnit\Framework\TestCase;

class ThreatScorerTest extends TestCase
{
    /**
     * Exact test matching the corrected example in docs/CONTRACTS.md §3.3:
     * raw spike 5.1 (weight 40) -> 34.0
     * raw anomaly 0.40 (weight 30) -> 12.0
     * raw sentiment 0.62 (weight 20) -> 12.4
     * raw reach 0.67 (weight 10) -> 6.7
     * sum = 65.1 => round = 65 => medium severity
     */
    public function test_matches_contracts_specification_example_exactly(): void
    {
        $input = [
            'z' => 5.1,
            'has_sufficient_baseline' => true,
            'anomaly_ratio' => 0.40,
            'sentiment_ratio' => 0.62,
            'reach_ratio' => 0.67,
        ];

        $result = ThreatScorer::score($input);

        $this->assertSame(65, $result['score']);
        $this->assertSame('medium', $result['severity']);

        $bd = $result['score_breakdown'];

        // Spike
        $this->assertSame(5.1, $bd['spike']['raw']);
        $this->assertSame(40, $bd['spike']['weight']);
        $this->assertEquals(34.0, $bd['spike']['value']);

        // Anomaly
        $this->assertSame(0.4, $bd['anomaly']['raw']);
        $this->assertSame(30, $bd['anomaly']['weight']);
        $this->assertEquals(12.0, $bd['anomaly']['value']);

        // Sentiment
        $this->assertSame(0.62, $bd['sentiment']['raw']);
        $this->assertSame(20, $bd['sentiment']['weight']);
        $this->assertEquals(12.4, $bd['sentiment']['value']);

        // Reach
        $this->assertSame(0.67, $bd['reach']['raw']);
        $this->assertSame(10, $bd['reach']['weight']);
        $this->assertEquals(6.7, $bd['reach']['value']);

        // Thresholds
        $this->assertSame(3.0, $bd['thresholds']['z']);
        $this->assertSame(40, $bd['thresholds']['severity_medium']);
        $this->assertSame(70, $bd['thresholds']['severity_high']);

        // Alias breakdown
        $this->assertSame($result['score_breakdown'], $result['breakdown']);
    }

    public function test_computes_ratios_from_raw_counts(): void
    {
        $input = [
            'z' => 6.0,
            'has_sufficient_baseline' => true,
            'anomalous_accounts' => 10,
            'unique_accounts' => 20, // 10/20 = 0.50 => 0.50 * 30 = 15.0
            'negative_posts' => 40,
            'total_posts' => 100,    // 40/100 = 0.40 => 0.40 * 20 = 8.0
            'source_count' => 1,
            'active_sources' => 2,   // 1/2 = 0.50 => 0.50 * 10 = 5.0
        ];

        $result = ThreatScorer::score($input);

        // 40.0 (spike) + 15.0 (anomaly) + 8.0 (sentiment) + 5.0 (reach) = 68.0
        $this->assertSame(68, $result['score']);
        $this->assertSame('medium', $result['severity']);
        $this->assertEquals(40.0, $result['score_breakdown']['spike']['value']);
        $this->assertEquals(15.0, $result['score_breakdown']['anomaly']['value']);
        $this->assertEquals(8.0, $result['score_breakdown']['sentiment']['value']);
        $this->assertEquals(5.0, $result['score_breakdown']['reach']['value']);
    }

    public function test_spike_component_is_zero_when_baseline_insufficient(): void
    {
        $input = [
            'z' => 10.0, // High z
            'has_sufficient_baseline' => false, // but insufficient baseline (PRD §10.8)
            'anomaly_ratio' => 0.5,
            'sentiment_ratio' => 0.5,
            'reach_ratio' => 0.5,
        ];

        $result = ThreatScorer::score($input);

        $this->assertEquals(0.0, $result['score_breakdown']['spike']['value']);
        $this->assertSame(10.0, $result['score_breakdown']['spike']['raw']);

        // score should only be anomaly (15) + sentiment (10) + reach (5) = 30
        $this->assertSame(30, $result['score']);
        $this->assertSame('low', $result['severity']);
    }

    public function test_caps_each_component_at_maximum_weight(): void
    {
        // Outlandish values that exceed 1.0 ratio
        $input = [
            'z' => 24.0, // z / 6 = 4.0 => capped at 1.0 (40)
            'has_sufficient_baseline' => true,
            'anomalous_accounts' => 50,
            'unique_accounts' => 10, // 5.0 => capped at 1.0 (30)
            'negative_posts' => 200,
            'total_posts' => 50,     // 4.0 => capped at 1.0 (20)
            'source_count' => 10,
            'active_sources' => 2,   // 5.0 => capped at 1.0 (10)
        ];

        $result = ThreatScorer::score($input);

        $this->assertSame(100, $result['score']);
        $this->assertSame('high', $result['severity']);
        $this->assertEquals(40.0, $result['score_breakdown']['spike']['value']);
        $this->assertEquals(30.0, $result['score_breakdown']['anomaly']['value']);
        $this->assertEquals(20.0, $result['score_breakdown']['sentiment']['value']);
        $this->assertEquals(10.0, $result['score_breakdown']['reach']['value']);
    }

    public function test_zero_division_and_empty_inputs_safety(): void
    {
        $input = [
            'z' => 0.0,
            'unique_accounts' => 0,
            'total_posts' => 0,
            'active_sources' => 0,
        ];

        $result = ThreatScorer::score($input);

        $this->assertSame(0, $result['score']);
        $this->assertSame('low', $result['severity']);
        $this->assertEquals(0.0, $result['score_breakdown']['spike']['value']);
        $this->assertEquals(0.0, $result['score_breakdown']['anomaly']['value']);
        $this->assertEquals(0.0, $result['score_breakdown']['sentiment']['value']);
        $this->assertEquals(0.0, $result['score_breakdown']['reach']['value']);
    }

    public function test_negative_values_are_clamped_to_zero(): void
    {
        $input = [
            'z' => -5.0,
            'anomaly_ratio' => -0.5,
            'sentiment_ratio' => -0.2,
            'reach_ratio' => -1.0,
        ];

        $result = ThreatScorer::score($input);

        $this->assertSame(0, $result['score']);
        $this->assertSame('low', $result['severity']);
    }

    public function test_respects_custom_weights_and_cutoffs(): void
    {
        $input = [
            'z' => 3.0, // 3/6 = 0.5 * 50 = 25.0
            'anomaly_ratio' => 0.5, // 0.5 * 25 = 12.5
            'sentiment_ratio' => 0.5, // 0.5 * 15 = 7.5
            'reach_ratio' => 0.5, // 0.5 * 10 = 5.0
        ];

        $options = [
            'weights' => [
                'spike' => 50,
                'anomaly' => 25,
                'sentiment' => 15,
                'reach' => 10,
            ],
            'severity_cutoffs' => [
                'medium' => 45,
                'high' => 80,
            ],
            'z_divisor' => 6.0,
            'z_threshold' => 2.5,
        ];

        $result = ThreatScorer::score($input, $options);

        // 25.0 + 12.5 + 7.5 + 5.0 = 50.0 => score 50
        $this->assertSame(50, $result['score']);
        // 50 >= 45 (medium) and < 80 => 'medium'
        $this->assertSame('medium', $result['severity']);
        $this->assertSame(50, $result['score_breakdown']['spike']['weight']);
        $this->assertSame(2.5, $result['score_breakdown']['thresholds']['z']);
        $this->assertSame(45, $result['score_breakdown']['thresholds']['severity_medium']);
        $this->assertSame(80, $result['score_breakdown']['thresholds']['severity_high']);
    }

    public function test_severity_cutoff_exact_boundaries(): void
    {
        $cutoffs = ['medium' => 40, 'high' => 70];

        $this->assertSame('low', ThreatScorer::determineSeverity(0, $cutoffs));
        $this->assertSame('low', ThreatScorer::determineSeverity(39, $cutoffs));
        $this->assertSame('medium', ThreatScorer::determineSeverity(40, $cutoffs));
        $this->assertSame('medium', ThreatScorer::determineSeverity(69, $cutoffs));
        $this->assertSame('high', ThreatScorer::determineSeverity(70, $cutoffs));
        $this->assertSame('high', ThreatScorer::determineSeverity(100, $cutoffs));
    }

    public function test_score_impersonation_kind_according_to_prd(): void
    {
        // High similarity + young account: round(0.85 * 70) + 30 = 60 + 30 = 90 => 'high'
        $high = ThreatScorer::scoreImpersonation(0.85, true);
        $this->assertSame(90, $high['score']);
        $this->assertSame('high', $high['severity']);
        $this->assertEquals(59.5, $high['score_breakdown']['similarity']['value']);
        $this->assertEquals(30.0, $high['score_breakdown']['young_account']['value']);

        // Medium similarity, not young account: round(0.65 * 70) + 0 = 46 => 'medium'
        $medium = ThreatScorer::scoreImpersonation(0.65, false);
        $this->assertSame(46, $medium['score']);
        $this->assertSame('medium', $medium['severity']);
        $this->assertEquals(0.0, $medium['score_breakdown']['young_account']['value']);

        // Low similarity, not young: round(0.50 * 70) = 35 => 'low'
        $low = ThreatScorer::scoreImpersonation(0.50, false);
        $this->assertSame(35, $low['score']);
        $this->assertSame('low', $low['severity']);
    }

    public function test_pure_function_has_no_side_effects_and_deterministic(): void
    {
        $input = [
            'z' => 4.2,
            'anomalous_accounts' => 6,
            'unique_accounts' => 15,
            'negative_posts' => 30,
            'total_posts' => 80,
            'source_count' => 2,
            'active_sources' => 4,
        ];

        $res1 = ThreatScorer::score($input);
        $res2 = ThreatScorer::score($input);

        $this->assertSame($res1, $res2);
    }
}
