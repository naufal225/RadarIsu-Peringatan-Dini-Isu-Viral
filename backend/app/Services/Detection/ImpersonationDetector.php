<?php

namespace App\Services\Detection;

/**
 * Impersonation decision for one account (F13, PRD §10.7). Pure: pg_trgm computed the similarities,
 * this class applies the PRD's rules to them.
 *
 *  - the similarity of an account to an official account is the highest `similarity()` over its
 *    handle/handle and display name/display name comparisons, each on every reading of the name
 *    (AccountNameNormalizer variants);
 *  - it fires when that is >= impersonation_threshold;
 *  - it never fires for an account whose handle IS an official handle (compared without "@" and case):
 *    the official account itself, or a copy of its record, is not an impersonator.
 *
 * Among several official accounts the closest one is reported, and the others stay as evidence.
 */
class ImpersonationDetector
{
    /** Most other official accounts listed next to the closest one. */
    public const OTHER_MATCHES = 3;

    /** Similarity at or above this means the names are the same once normalized. */
    public const SAME_NAME = 0.999;

    /**
     * @param  array{id: int, handle: string, platform_created_at: int|null}  $account
     * @param  list<array{official_id: int, field: string, variant: string, similarity: float}>  $matches  every comparison at or above the threshold
     * @param  array<int, array{handle: string, display_name: string}>  $officials  by id
     * @param  array<string, array<string, list<array<string, mixed>>>>  $rules  field => variant key => rules of that reading
     * @param  array<string, mixed>  $settings  Setting::detection()
     * @param  int  $now  data clock, unix seconds
     * @return array{
     *     triggered: bool, is_official: bool, official_id: int|null, similarity: float, field: string|null, variant: string|null,
     *     same_name: bool, rules: list<array<string, mixed>>, other_matches: list<array{official_id: int, similarity: float, field: string}>,
     *     young: bool, age_days: float|null
     * }
     */
    public static function decide(array $account, array $matches, array $officials, array $rules, array $settings, int $now): array
    {
        $none = [
            'triggered' => false, 'is_official' => false, 'official_id' => null, 'similarity' => 0.0, 'field' => null, 'variant' => null,
            'same_name' => false, 'rules' => [], 'other_matches' => [], 'young' => false, 'age_days' => null,
        ];

        $handle = self::bare($account['handle']);
        foreach ($officials as $official) {
            if (self::bare($official['handle']) === $handle) {
                return ['is_official' => true] + $none;
            }
        }

        $threshold = (float) $settings['impersonation_threshold'];
        $matches = array_values(array_filter($matches, static fn ($m) => $m['similarity'] >= $threshold));
        if ($matches === []) {
            return $none;
        }

        // Closest first; ties go to the handle, then to the plain reading, then to the older official account.
        usort($matches, static fn ($a, $b) => [-$a['similarity'], $a['field'] === 'handle' ? 0 : 1, $a['variant'] === 'base' ? 0 : 1, $a['official_id']]
            <=> [-$b['similarity'], $b['field'] === 'handle' ? 0 : 1, $b['variant'] === 'base' ? 0 : 1, $b['official_id']]);
        $best = $matches[0];

        $others = [];
        foreach ($matches as $match) {
            if ($match['official_id'] !== $best['official_id'] && ! isset($others[$match['official_id']])) {
                $others[$match['official_id']] = ['official_id' => $match['official_id'], 'similarity' => round($match['similarity'], 3), 'field' => $match['field']];
            }
        }

        $created = $account['platform_created_at'];
        $age = $created !== null && $created <= $now ? $now - $created : null;

        return [
            'triggered' => true,
            'is_official' => false,
            'official_id' => $best['official_id'],
            'similarity' => round($best['similarity'], 3),
            'field' => $best['field'],
            'variant' => $best['variant'],
            'same_name' => $best['similarity'] >= self::SAME_NAME,
            'rules' => $rules[$best['field']][$best['variant']] ?? [],
            'other_matches' => array_slice(array_values($others), 0, self::OTHER_MATCHES),
            'young' => $age !== null && $age < (int) $settings['young_account_days'] * 86400,
            'age_days' => $age === null ? null : round($age / 86400, 1),
        ];
    }

    private static function bare(string $handle): string
    {
        return mb_strtolower(ltrim(trim($handle), '@'));
    }
}
