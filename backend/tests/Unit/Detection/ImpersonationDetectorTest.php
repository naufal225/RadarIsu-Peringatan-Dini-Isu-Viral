<?php

namespace Tests\Unit\Detection;

use App\Models\Setting;
use App\Services\Detection\ImpersonationDetector;
use PHPUnit\Framework\TestCase;

/**
 * PRD §10.7 and §19.3 item 4. Pure: the similarities pg_trgm would compute are given by hand.
 */
class ImpersonationDetectorTest extends TestCase
{
    private const NOW = 1_800_000_000;

    private const DAY = 86400;

    /** @var array<int, array{handle: string, display_name: string}> */
    private array $officials = [
        1 => ['handle' => '@kodam_contoh', 'display_name' => 'Kodam Contoh'],
        2 => ['handle' => '@humas_kodam', 'display_name' => 'Humas Kodam'],
    ];

    /** @param array<string, mixed> $changes */
    private function settings(array $changes = []): array
    {
        return array_replace(Setting::DETECTION_DEFAULTS, $changes);
    }

    /** @return array{id: int, handle: string, platform_created_at: int|null} */
    private function account(string $handle = '@kodam_c0ntoh', ?int $createdAt = null): array
    {
        return ['id' => 10, 'handle' => $handle, 'platform_created_at' => $createdAt];
    }

    /** @return array{official_id: int, field: string, variant: string, similarity: float} */
    private function match(float $similarity, int $official = 1, string $field = 'handle', string $variant = 'base'): array
    {
        return ['official_id' => $official, 'field' => $field, 'variant' => $variant, 'similarity' => $similarity];
    }

    /** @param list<array<string, mixed>> $matches */
    private function decide(array $matches, ?array $account = null, array $settings = [], array $rules = []): array
    {
        return ImpersonationDetector::decide($account ?? $this->account(), $matches, $this->officials, $rules, $this->settings($settings), self::NOW);
    }

    public function test_a_look_alike_of_an_official_account_is_flagged(): void
    {
        $result = $this->decide([$this->match(0.85)]);

        $this->assertTrue($result['triggered']);
        $this->assertSame(1, $result['official_id']);
        $this->assertSame(0.85, $result['similarity']);
        $this->assertSame('handle', $result['field']);
    }

    public function test_no_match_is_not_flagged(): void
    {
        $result = $this->decide([]);

        $this->assertFalse($result['triggered']);
        $this->assertNull($result['official_id']);
        $this->assertFalse($result['is_official']);
    }

    public function test_a_match_below_the_threshold_is_ignored(): void
    {
        $this->assertFalse($this->decide([$this->match(0.59)])['triggered']);
        $this->assertTrue($this->decide([$this->match(0.6)])['triggered']); // inclusive
    }

    public function test_the_threshold_comes_from_settings(): void
    {
        $this->assertFalse($this->decide([$this->match(0.7)], null, ['impersonation_threshold' => 0.8])['triggered']);
        $this->assertTrue($this->decide([$this->match(0.7)], null, ['impersonation_threshold' => 0.5])['triggered']);
    }

    public function test_an_account_whose_handle_is_official_is_never_flagged(): void
    {
        $result = $this->decide([$this->match(1.0)], $this->account('@kodam_contoh'));

        $this->assertFalse($result['triggered']);
        $this->assertTrue($result['is_official']);
    }

    public function test_the_official_handle_is_compared_without_at_sign_and_case(): void
    {
        foreach (['kodam_contoh', '@KODAM_CONTOH', ' @Kodam_Contoh '] as $handle) {
            $this->assertTrue($this->decide([$this->match(1.0)], $this->account($handle))['is_official'], $handle);
        }
    }

    public function test_a_handle_that_only_looks_the_same_is_not_the_official_one(): void
    {
        $result = $this->decide([$this->match(1.0)], $this->account('@kodam.contoh'));

        $this->assertTrue($result['triggered']);
        $this->assertTrue($result['same_name']);
    }

    public function test_the_closest_official_account_wins_and_the_others_are_listed(): void
    {
        $result = $this->decide([$this->match(0.7, 1), $this->match(0.9, 2), $this->match(0.65, 1, 'display_name')]);

        $this->assertSame(2, $result['official_id']);
        $this->assertSame(0.9, $result['similarity']);
        $this->assertSame([['official_id' => 1, 'similarity' => 0.7, 'field' => 'handle']], $result['other_matches']);
    }

    public function test_ties_go_to_the_handle_then_the_plain_reading_then_the_older_official(): void
    {
        $this->assertSame('handle', $this->decide([$this->match(0.8, 1, 'display_name'), $this->match(0.8, 1, 'handle')])['field']);
        $this->assertSame('base', $this->decide([$this->match(0.8, 1, 'handle', 'stripped'), $this->match(0.8, 1, 'handle', 'base')])['variant']);
        $this->assertSame(1, $this->decide([$this->match(0.8, 2), $this->match(0.8, 1)])['official_id']);
    }

    public function test_other_matches_are_limited_and_distinct(): void
    {
        $officials = [];
        $matches = [$this->match(0.99, 1)];
        for ($id = 2; $id <= 8; $id++) {
            $officials[$id] = ['handle' => "@o{$id}", 'display_name' => "O {$id}"];
            $matches[] = $this->match(0.7, $id);
            $matches[] = $this->match(0.68, $id, 'display_name');
        }
        $officials[1] = $this->officials[1];

        $result = ImpersonationDetector::decide($this->account(), $matches, $officials, [], $this->settings(), self::NOW);

        $this->assertCount(ImpersonationDetector::OTHER_MATCHES, $result['other_matches']);
        $this->assertSame(array_unique(array_column($result['other_matches'], 'official_id')), array_column($result['other_matches'], 'official_id'));
    }

    public function test_the_rules_of_the_winning_reading_are_reported(): void
    {
        $rules = ['handle' => [
            'base' => [['rule' => 'separators_removed']],
            'stripped' => [['rule' => 'affix_stripped', 'value' => 'official', 'position' => 'suffix']],
        ]];

        $result = $this->decide([$this->match(0.7, 1, 'handle', 'base'), $this->match(0.95, 1, 'handle', 'stripped')], null, [], $rules);

        $this->assertSame('stripped', $result['variant']);
        $this->assertSame([['rule' => 'affix_stripped', 'value' => 'official', 'position' => 'suffix']], $result['rules']);
    }

    public function test_an_account_younger_than_the_limit_is_young(): void
    {
        $result = $this->decide([$this->match(0.85)], $this->account('@kodam_c0ntoh', self::NOW - 3 * self::DAY));

        $this->assertTrue($result['young']);
        $this->assertSame(3.0, $result['age_days']);
    }

    public function test_the_young_limit_is_exclusive_and_comes_from_settings(): void
    {
        $thirty = $this->account('@x_kodam', self::NOW - 30 * self::DAY);

        $this->assertFalse($this->decide([$this->match(0.85)], $thirty)['young']);
        $this->assertTrue($this->decide([$this->match(0.85)], $thirty, ['young_account_days' => 31])['young']);
    }

    public function test_an_old_account_is_not_young(): void
    {
        $this->assertFalse($this->decide([$this->match(0.85)], $this->account('@x_kodam', self::NOW - 400 * self::DAY))['young']);
    }

    public function test_an_unknown_or_impossible_age_is_not_young(): void
    {
        $unknown = $this->decide([$this->match(0.85)], $this->account('@x_kodam', null));
        $future = $this->decide([$this->match(0.85)], $this->account('@x_kodam', self::NOW + 3600));

        $this->assertFalse($unknown['young']);
        $this->assertNull($unknown['age_days']);
        $this->assertFalse($future['young']);
        $this->assertNull($future['age_days']);
    }

    public function test_a_perfect_match_is_marked_as_the_same_name(): void
    {
        $this->assertTrue($this->decide([$this->match(1.0)])['same_name']);
        $this->assertFalse($this->decide([$this->match(0.9)])['same_name']);
    }

    public function test_same_inputs_give_the_same_result(): void
    {
        $matches = [$this->match(0.7, 1), $this->match(0.7, 2, 'display_name')];

        $this->assertSame($this->decide($matches), $this->decide(array_reverse($matches)));
    }
}
