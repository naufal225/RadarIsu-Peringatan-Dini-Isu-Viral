<?php

namespace Tests\Unit\Evaluation;

use App\Services\Evaluation\EvaluationCalculator;
use PHPUnit\Framework\TestCase;

class EvaluationCalculatorTest extends TestCase
{
    private function calc(array $truth, array $predicted, int $mixed = 0): array
    {
        return (new EvaluationCalculator)->calculate($truth, $predicted, $mixed);
    }

    public function test_counts_true_false_positives_and_false_negatives(): void
    {
        // 1,2,3 anomalous; 4,5 organic. Flagged: 1,2 (hit), 4 (false alarm). 3 is missed.
        $r = $this->calc([1 => true, 2 => true, 3 => true, 4 => false, 5 => false], [1, 2, 4]);

        $this->assertSame([2, 1, 1], [$r['tp'], $r['fp'], $r['fn']]);
        $this->assertEqualsWithDelta(0.6667, $r['precision'], 0.0001);
        $this->assertEqualsWithDelta(0.6667, $r['recall'], 0.0001);
        $this->assertEqualsWithDelta(0.6667, $r['f1'], 0.0001);
        $this->assertSame([], $r['notes']);
    }

    public function test_only_labeled_accounts_are_counted(): void
    {
        // Account 99 is flagged but has no label: it is neither a TP nor an FP.
        $r = $this->calc([1 => true, 2 => false], [1, 99]);

        $this->assertSame([1, 0, 0], [$r['tp'], $r['fp'], $r['fn']]);
        $this->assertSame(1.0, $r['precision']);
    }

    public function test_a_perfect_run(): void
    {
        $r = $this->calc([1 => true, 2 => true, 3 => false], [1, 2]);

        $this->assertSame([1.0, 1.0, 1.0], [$r['precision'], $r['recall'], $r['f1']]);
    }

    public function test_no_labels_gives_zero_with_notes(): void
    {
        $r = $this->calc([], [1, 2]);

        $this->assertSame([0, 0, 0], [$r['tp'], $r['fp'], $r['fn']]);
        $this->assertSame([0.0, 0.0, 0.0], [$r['precision'], $r['recall'], $r['f1']]);
        $this->assertSame(['no_labeled_accounts', 'no_predicted_positive', 'no_actual_positive'], $r['notes']);
    }

    public function test_nothing_flagged_means_zero_precision_and_recall(): void
    {
        $r = $this->calc([1 => true, 2 => false], []);

        $this->assertSame([0, 0, 1], [$r['tp'], $r['fp'], $r['fn']]);
        $this->assertSame([0.0, 0.0, 0.0], [$r['precision'], $r['recall'], $r['f1']]);
        $this->assertSame(['no_predicted_positive'], $r['notes']);
    }

    public function test_no_anomalous_account_means_zero_recall_note(): void
    {
        $r = $this->calc([1 => false, 2 => false], [1]);

        $this->assertSame([0, 1, 0], [$r['tp'], $r['fp'], $r['fn']]);
        $this->assertSame(0.0, $r['recall']);
        $this->assertSame(['no_actual_positive'], $r['notes']);
    }

    public function test_mixed_label_accounts_are_noted(): void
    {
        $r = $this->calc([1 => true], [1], 1);

        $this->assertSame(['mixed_label_accounts:1'], $r['notes']);
    }
}
