<?php

namespace App\Services\Detection;

/**
 * Coordination decision for the posts of one topic inside one window (F4, PRD §10.6). Pure: the
 * database finds the similar pairs, this class clusters them and decides what counts as coordination.
 *
 *  1. Greedy clustering in time order: a post joins the first cluster whose first post (its seed) it is
 *     similar to (>= similarity_threshold), otherwise it starts a new cluster. Comparing against the
 *     seed only keeps a chain A~B, B~C from pulling in an unrelated C.
 *  2. A cluster is coordinated when it has at least min_accounts_cluster DISTINCT accounts, so one
 *     account repeating itself is never coordination.
 *  3. Per account of a coordinated cluster: `similar_text` always, `young_account` when the account was
 *     younger than young_account_days when it posted, and `synchronized_posting` when at least
 *     synchronized_ratio of the cluster's posts fall inside one synchronized_window_minutes span.
 *
 * An account whose creation date is unknown is not treated as young: age cannot be shown.
 */
class CoordinationDetector
{
    /**
     * @param  list<array{id: int, account_id: int, posted_at: int, account_created_at: int|null}>  $posts  unix seconds
     * @param  list<array{0: int, 1: int, 2: float}>  $pairs  [post id, post id, similarity] of similar pairs found by pg_trgm
     * @param  array<string, mixed>  $settings  Setting::detection()
     * @return array{
     *     triggered: bool, posts_considered: int, accounts_considered: int,
     *     clusters: list<array<string, mixed>>, flagged_account_ids: list<int>, flagged_post_ids: list<int>,
     *     thresholds: array<string, int|float>
     * }
     */
    public static function detect(array $posts, array $pairs, array $settings): array
    {
        $threshold = (float) $settings['similarity_threshold'];
        $minAccounts = (int) $settings['min_accounts_cluster'];

        usort($posts, static fn ($a, $b) => [$a['posted_at'], $a['id']] <=> [$b['posted_at'], $b['id']]);

        $similarity = [];
        foreach ($pairs as [$a, $b, $value]) {
            if ($value >= $threshold) {
                $similarity[min($a, $b).'-'.max($a, $b)] = (float) $value;
            }
        }

        $clusters = [];
        foreach ($posts as $post) {
            $joined = false;
            foreach (array_keys($clusters) as $key) {
                $seedId = $clusters[$key]['seed']['id'];
                if (isset($similarity[min($seedId, $post['id']).'-'.max($seedId, $post['id'])])) {
                    $clusters[$key]['posts'][] = $post;
                    $joined = true;
                    break;
                }
            }
            if (! $joined) {
                $clusters[] = ['seed' => $post, 'posts' => [$post]];
            }
        }

        $coordinated = [];
        $flaggedAccounts = [];
        $flaggedPosts = [];
        foreach ($clusters as $cluster) {
            if (count(array_unique(array_column($cluster['posts'], 'account_id'))) < $minAccounts) {
                continue;
            }
            $built = self::describe(count($coordinated) + 1, $cluster, $similarity, $settings);
            $coordinated[] = $built;
            foreach ($built['accounts'] as $accountId => $_) {
                $flaggedAccounts[$accountId] = true;
            }
            foreach ($built['post_ids'] as $postId) {
                $flaggedPosts[$postId] = true;
            }
        }

        return [
            'triggered' => $coordinated !== [],
            'posts_considered' => count($posts),
            'accounts_considered' => count(array_unique(array_column($posts, 'account_id'))),
            'clusters' => $coordinated,
            'flagged_account_ids' => array_map('intval', array_keys($flaggedAccounts)),
            'flagged_post_ids' => array_map('intval', array_keys($flaggedPosts)),
            'thresholds' => [
                'similarity_threshold' => $threshold,
                'min_accounts_cluster' => $minAccounts,
                'coordination_window_minutes' => (int) $settings['coordination_window_minutes'],
                'young_account_days' => (int) $settings['young_account_days'],
                'synchronized_window_minutes' => (int) $settings['synchronized_window_minutes'],
                'synchronized_ratio' => (float) $settings['synchronized_ratio'],
            ],
        ];
    }

    /**
     * Longest run of times (ascending) that fits in `$spanSeconds`.
     *
     * @param  list<int>  $times  sorted ascending
     * @return array{count: int, from: int, to: int} indexes of the first and last time of the run
     */
    public static function densestRun(array $times, int $spanSeconds): array
    {
        $best = ['count' => 0, 'from' => 0, 'to' => -1];
        $left = 0;
        foreach ($times as $right => $time) {
            while ($time - $times[$left] > $spanSeconds) {
                $left++;
            }
            if ($right - $left + 1 > $best['count']) {
                $best = ['count' => $right - $left + 1, 'from' => $left, 'to' => $right];
            }
        }

        return $best;
    }

    /**
     * @param  array{seed: array<string, mixed>, posts: list<array<string, mixed>>}  $cluster
     * @param  array<string, float>  $similarity
     * @param  array<string, mixed>  $settings
     * @return array<string, mixed>
     */
    private static function describe(int $clusterId, array $cluster, array $similarity, array $settings): array
    {
        $seed = $cluster['seed'];
        $posts = $cluster['posts']; // time order, seed first
        $youngSeconds = (int) $settings['young_account_days'] * 86400;

        $sims = [];
        foreach ($posts as $post) {
            $sims[$post['id']] = $post['id'] === $seed['id'] ? null : $similarity[min($seed['id'], $post['id']).'-'.max($seed['id'], $post['id'])];
        }
        $others = array_filter($sims, static fn ($v) => $v !== null);

        // Synchronized: the densest synchronized_window_minutes of the cluster's posts.
        $times = array_column($posts, 'posted_at');
        $run = self::densestRun($times, (int) $settings['synchronized_window_minutes'] * 60);
        $ratio = count($posts) > 0 ? $run['count'] / count($posts) : 0.0;
        $isSynchronized = $ratio >= (float) $settings['synchronized_ratio'];
        $syncPostIds = array_column(array_slice($posts, $run['from'], $run['count']), 'id');

        $accounts = [];
        foreach ($posts as $post) {
            $id = $post['account_id'];
            if (isset($accounts[$id])) {
                $accounts[$id]['posts_count']++;

                continue;
            }
            // The first post of the account in the cluster represents it.
            $created = $post['account_created_at'];
            $age = $created !== null && $created <= $post['posted_at'] ? $post['posted_at'] - $created : null;
            $accounts[$id] = [
                'post_id' => $post['id'],
                'posts_count' => 1,
                'similarity' => round($post['id'] === $seed['id'] ? ($others === [] ? 1.0 : max($others)) : $sims[$post['id']], 3),
                'age_days' => $age === null ? null : round($age / 86400, 1),
                'young' => $age !== null && $age < $youngSeconds,
                'synchronized' => $isSynchronized && in_array($post['id'], $syncPostIds, true),
            ];
        }

        return [
            'cluster_id' => $clusterId,
            'seed_post_id' => $seed['id'],
            'seed_account_id' => $seed['account_id'],
            'post_ids' => array_column($posts, 'id'),
            'posts_count' => count($posts),
            'accounts_count' => count($accounts),
            'similarity_min' => $others === [] ? 1.0 : round(min($others), 3),
            'similarity_max' => $others === [] ? 1.0 : round(max($others), 3),
            'from' => min($times),
            'to' => max($times),
            'synchronized' => [
                'is_synchronized' => $isSynchronized,
                'ratio' => round($ratio, 3),
                'posts_in_window' => $run['count'],
                'window_minutes' => (int) $settings['synchronized_window_minutes'],
            ],
            'accounts' => $accounts,
        ];
    }
}
