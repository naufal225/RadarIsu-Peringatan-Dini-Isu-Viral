<?php

namespace Tests\Unit\Detection;

use App\Models\Setting;
use App\Services\Detection\CoordinationDetector;
use PHPUnit\Framework\TestCase;

/**
 * PRD §10.6 and §19.3 item 3. Pure: the pairs pg_trgm would find are given by hand.
 */
class CoordinationDetectorTest extends TestCase
{
    private const T0 = 1_800_000_000;

    /** @param array<string, mixed> $changes */
    private function settings(array $changes = []): array
    {
        return array_replace(Setting::DETECTION_DEFAULTS, $changes);
    }

    /**
     * One post per account, ids 1..n, `$gap` seconds apart.
     *
     * @return list<array{id: int, account_id: int, posted_at: int, account_created_at: int|null}>
     */
    private function posts(int $accounts, int $gap = 30, ?int $createdAt = null): array
    {
        $posts = [];
        for ($i = 1; $i <= $accounts; $i++) {
            $posts[] = ['id' => $i, 'account_id' => 100 + $i, 'posted_at' => self::T0 + ($i - 1) * $gap, 'account_created_at' => $createdAt];
        }

        return $posts;
    }

    /**
     * Every post pairs with the first one (the seed).
     *
     * @return list<array{0: int, 1: int, 2: float}>
     */
    private function starPairs(int $count, float $similarity = 0.9): array
    {
        $pairs = [];
        for ($i = 2; $i <= $count; $i++) {
            $pairs[] = [1, $i, $similarity];
        }

        return $pairs;
    }

    public function test_five_accounts_with_near_identical_text_are_coordinated(): void
    {
        $result = CoordinationDetector::detect($this->posts(5), $this->starPairs(5), $this->settings());

        $this->assertTrue($result['triggered']);
        $this->assertCount(1, $result['clusters']);
        $cluster = $result['clusters'][0];
        $this->assertSame(1, $cluster['cluster_id']);
        $this->assertSame(5, $cluster['accounts_count']);
        $this->assertSame([101, 102, 103, 104, 105], array_keys($cluster['accounts']));
        $this->assertSame([101, 102, 103, 104, 105], $result['flagged_account_ids']);
        $this->assertSame(0.9, $cluster['accounts'][102]['similarity']);
        $this->assertSame(0.9, $cluster['accounts'][101]['similarity']); // the seed reports its best match
    }

    public function test_four_accounts_are_not_enough(): void
    {
        $result = CoordinationDetector::detect($this->posts(4), $this->starPairs(4), $this->settings());

        $this->assertFalse($result['triggered']);
        $this->assertSame([], $result['clusters']);
        $this->assertSame([], $result['flagged_account_ids']);
    }

    public function test_one_account_repeating_itself_is_not_coordination(): void
    {
        $posts = [];
        for ($i = 1; $i <= 12; $i++) {
            $posts[] = ['id' => $i, 'account_id' => 7, 'posted_at' => self::T0 + $i, 'account_created_at' => null];
        }

        $result = CoordinationDetector::detect($posts, $this->starPairs(12, 1.0), $this->settings());

        $this->assertFalse($result['triggered']);
        $this->assertSame(1, $result['accounts_considered']);
    }

    public function test_min_accounts_comes_from_settings(): void
    {
        $this->assertTrue(CoordinationDetector::detect($this->posts(3), $this->starPairs(3), $this->settings(['min_accounts_cluster' => 3]))['triggered']);
        $this->assertFalse(CoordinationDetector::detect($this->posts(3), $this->starPairs(3), $this->settings(['min_accounts_cluster' => 4]))['triggered']);
    }

    public function test_pairs_below_the_threshold_do_not_cluster(): void
    {
        $result = CoordinationDetector::detect($this->posts(6), $this->starPairs(6, 0.79), $this->settings());

        $this->assertFalse($result['triggered']);
    }

    public function test_the_threshold_boundary_is_inclusive(): void
    {
        $result = CoordinationDetector::detect($this->posts(5), $this->starPairs(5, 0.8), $this->settings());

        $this->assertTrue($result['triggered']);
    }

    public function test_no_posts_and_no_pairs_is_not_an_error(): void
    {
        $result = CoordinationDetector::detect([], [], $this->settings());

        $this->assertFalse($result['triggered']);
        $this->assertSame(0, $result['posts_considered']);
        $this->assertSame(0, $result['accounts_considered']);
    }

    public function test_posts_without_any_similar_pair_form_no_cluster(): void
    {
        $result = CoordinationDetector::detect($this->posts(20), [], $this->settings());

        $this->assertFalse($result['triggered']);
        $this->assertSame(20, $result['accounts_considered']);
    }

    public function test_a_chain_does_not_pull_in_a_post_that_is_unlike_the_seed(): void
    {
        // 1~2, 2~3, but 3 is not similar to 1: 3 starts its own cluster instead of joining through 2.
        $posts = $this->posts(3);
        $result = CoordinationDetector::detect($posts, [[1, 2, 0.9], [2, 3, 0.9]], $this->settings(['min_accounts_cluster' => 2]));

        $this->assertCount(1, $result['clusters']);
        $this->assertSame([101, 102], array_keys($result['clusters'][0]['accounts']));
    }

    public function test_two_separate_campaigns_make_two_clusters(): void
    {
        $posts = $this->posts(10);
        $pairs = [];
        foreach ([2, 3, 4, 5] as $i) {
            $pairs[] = [1, $i, 0.9];
        }
        foreach ([7, 8, 9, 10] as $i) {
            $pairs[] = [6, $i, 0.85];
        }

        $result = CoordinationDetector::detect($posts, $pairs, $this->settings());

        $this->assertCount(2, $result['clusters']);
        $this->assertSame([1, 2], array_column($result['clusters'], 'cluster_id'));
        $this->assertSame([101, 102, 103, 104, 105, 106, 107, 108, 109, 110], $result['flagged_account_ids']);
    }

    public function test_input_order_does_not_change_the_result(): void
    {
        $posts = $this->posts(6);
        $pairs = $this->starPairs(6);

        $a = CoordinationDetector::detect($posts, $pairs, $this->settings());
        $b = CoordinationDetector::detect(array_reverse($posts), array_reverse($pairs), $this->settings());

        $this->assertSame($a, $b);
    }

    public function test_account_posting_twice_counts_once_and_is_represented_by_its_first_post(): void
    {
        $posts = $this->posts(5);
        $posts[] = ['id' => 6, 'account_id' => 103, 'posted_at' => self::T0 + 200, 'account_created_at' => null];

        $result = CoordinationDetector::detect($posts, array_merge($this->starPairs(5), [[1, 6, 0.95]]), $this->settings());

        $cluster = $result['clusters'][0];
        $this->assertSame(5, $cluster['accounts_count']);
        $this->assertSame(6, $cluster['posts_count']);
        $this->assertSame(3, $cluster['accounts'][103]['post_id']);
        $this->assertSame(2, $cluster['accounts'][103]['posts_count']);
    }

    public function test_young_accounts_are_marked_by_age_at_posting_time(): void
    {
        $day = 86400;
        $posts = $this->posts(5);
        $posts[0]['account_created_at'] = self::T0 - 3 * $day;      // 3 days: young
        $posts[1]['account_created_at'] = self::T0 - 29 * $day;     // 29 days: young
        $posts[2]['account_created_at'] = self::T0 - 30 * $day;     // exactly 30: not young
        $posts[3]['account_created_at'] = self::T0 - 400 * $day;    // old
        $posts[4]['account_created_at'] = null;                     // unknown: not young

        $accounts = CoordinationDetector::detect($posts, $this->starPairs(5), $this->settings())['clusters'][0]['accounts'];

        $this->assertTrue($accounts[101]['young']);
        $this->assertSame(3.0, $accounts[101]['age_days']);
        $this->assertTrue($accounts[102]['young']);
        $this->assertFalse($accounts[103]['young']);
        $this->assertFalse($accounts[104]['young']);
        $this->assertFalse($accounts[105]['young']);
        $this->assertNull($accounts[105]['age_days']);
    }

    public function test_an_account_created_after_it_posted_has_no_usable_age(): void
    {
        $posts = $this->posts(5);
        $posts[0]['account_created_at'] = self::T0 + 3600;

        $account = CoordinationDetector::detect($posts, $this->starPairs(5), $this->settings())['clusters'][0]['accounts'][101];

        $this->assertNull($account['age_days']);
        $this->assertFalse($account['young']);
    }

    public function test_young_account_days_comes_from_settings(): void
    {
        $posts = $this->posts(5, 30, self::T0 - 40 * 86400);

        $this->assertFalse(CoordinationDetector::detect($posts, $this->starPairs(5), $this->settings())['clusters'][0]['accounts'][101]['young']);
        $this->assertTrue(CoordinationDetector::detect($posts, $this->starPairs(5), $this->settings(['young_account_days' => 60]))['clusters'][0]['accounts'][101]['young']);
    }

    public function test_posts_inside_five_minutes_are_synchronized(): void
    {
        $cluster = CoordinationDetector::detect($this->posts(5, 60), $this->starPairs(5), $this->settings())['clusters'][0]; // 4 minutes in all

        $this->assertTrue($cluster['synchronized']['is_synchronized']);
        $this->assertSame(1.0, $cluster['synchronized']['ratio']);
        $this->assertTrue($cluster['accounts'][103]['synchronized']);
    }

    public function test_posts_spread_over_the_window_are_not_synchronized(): void
    {
        $cluster = CoordinationDetector::detect($this->posts(5, 200), $this->starPairs(5), $this->settings())['clusters'][0]; // 13 minutes

        $this->assertFalse($cluster['synchronized']['is_synchronized']);
        $this->assertLessThan(0.8, $cluster['synchronized']['ratio']);
        $this->assertFalse($cluster['accounts'][101]['synchronized']);
    }

    public function test_synchronized_needs_eighty_percent_of_the_cluster(): void
    {
        // 4 of 5 posts within 5 minutes, one straggler an hour later: exactly 0.8.
        $posts = $this->posts(5, 30);
        $posts[4]['posted_at'] = self::T0 + 3600;

        $cluster = CoordinationDetector::detect($posts, $this->starPairs(5), $this->settings())['clusters'][0];

        $this->assertSame(0.8, $cluster['synchronized']['ratio']);
        $this->assertTrue($cluster['synchronized']['is_synchronized']);
        $this->assertFalse($cluster['accounts'][105]['synchronized']); // the straggler is outside the window
        $this->assertTrue($cluster['accounts'][101]['synchronized']);

        $strict = CoordinationDetector::detect($posts, $this->starPairs(5), $this->settings(['synchronized_ratio' => 0.9]))['clusters'][0];
        $this->assertFalse($strict['synchronized']['is_synchronized']);
    }

    public function test_densest_run_finds_the_tightest_burst(): void
    {
        $this->assertSame(['count' => 3, 'from' => 2, 'to' => 4], CoordinationDetector::densestRun([0, 1000, 2000, 2060, 2100, 5000], 120));
        $this->assertSame(['count' => 1, 'from' => 0, 'to' => 0], CoordinationDetector::densestRun([0, 1000], 120));
        $this->assertSame(['count' => 0, 'from' => 0, 'to' => -1], CoordinationDetector::densestRun([], 120));
        $this->assertSame(2, CoordinationDetector::densestRun([0, 120], 120)['count']); // the span is inclusive
    }

    public function test_thresholds_in_use_are_reported(): void
    {
        $result = CoordinationDetector::detect($this->posts(5), $this->starPairs(5), $this->settings(['min_accounts_cluster' => 4]));

        $this->assertSame([
            'similarity_threshold' => 0.8,
            'min_accounts_cluster' => 4,
            'coordination_window_minutes' => 15,
            'young_account_days' => 30,
            'synchronized_window_minutes' => 5,
            'synchronized_ratio' => 0.8,
        ], $result['thresholds']);
    }
}
