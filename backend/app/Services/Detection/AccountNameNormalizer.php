<?php

namespace App\Services\Detection;

use Illuminate\Support\Facades\Log;
use Normalizer;

/**
 * Turns an account handle or display name into the strings pg_trgm compares (F13, PRD §10.7). Pure:
 * no database and no clock; the tables it uses come from config/impersonation.php.
 *
 * Every name has a `base` form: lowercase, Unicode NFKC, Cyrillic/Greek look-alikes folded to Latin,
 * look-alike characters mapped (0 -> o, rn -> m, ...), separators and spaces dropped. A name can have
 * extra readings, each compared on its own and each remembering the rules that produced it:
 *
 *  - `alt:<char>`   a character with a second plausible reading (1 as i as well as l);
 *  - `stripped`     the base without trailing digits ("name2024") and without an affix at either end
 *                   ("name_official", "id_name"), so that a decorated copy meets the original.
 *
 * Names too short to carry trigrams are dropped.
 */
class AccountNameNormalizer
{
    /** Shorter normalized names have too few trigrams to compare meaningfully. */
    public const MIN_LENGTH = 3;

    /** An affix is only stripped when at least this many characters remain, so "rapid" is not "rap". */
    public const MIN_REMAINING = 4;

    /** Trailing digits are only stripped when at least this many characters remain. */
    public const MIN_REMAINING_DIGITS = 3;

    private static bool $warnedNoIntl = false;

    /** @var array<string, string> */
    private array $confusables;

    /** @var array<string, string> */
    private array $alternatives;

    /** @var array<string, string> */
    private array $homoglyphs;

    /** @var list<string> longest first */
    private array $affixes;

    /**
     * @param  array{confusables?: array<string, string>, alternatives?: array<string, string>, homoglyphs?: array<string, string>, affixes?: list<string>}  $config
     */
    public function __construct(array $config)
    {
        $this->confusables = $config['confusables'] ?? [];
        $this->alternatives = $config['alternatives'] ?? [];
        $this->homoglyphs = $config['homoglyphs'] ?? [];
        $affixes = array_values(array_unique(array_map('mb_strtolower', $config['affixes'] ?? [])));
        usort($affixes, static fn ($a, $b) => mb_strlen($b) <=> mb_strlen($a));
        $this->affixes = $affixes;
    }

    public static function fromConfig(): self
    {
        return new self((array) config('impersonation'));
    }

    /**
     * The single comparable form of a name, or '' when it is too short.
     */
    public function normalize(string $value): string
    {
        return $this->variants($value)[0]['value'] ?? '';
    }

    /**
     * @return list<array{key: string, value: string, rules: list<array<string, mixed>>}> `base` first; empty when the base is too short
     */
    public function variants(string $value): array
    {
        [$folded, $rules] = $this->fold($value);
        [$base, $pairs] = $this->clean($folded);
        if (mb_strlen($base) < self::MIN_LENGTH) {
            return [];
        }

        $baseRules = $this->withPairs($rules, $pairs);
        if (preg_match('/[^\p{L}\p{N}]/u', $this->map($folded)[0]) === 1) {
            $baseRules[] = ['rule' => 'separators_removed'];
        }

        $variants = [['key' => 'base', 'value' => $base, 'rules' => $baseRules]];

        foreach ($this->alternatives as $char => $reading) {
            if (! str_contains($folded, (string) $char)) {
                continue;
            }
            [$alt, $altPairs] = $this->clean($folded, [$char => $reading]);
            if (mb_strlen($alt) >= self::MIN_LENGTH && $alt !== $base) {
                $variants[] = ['key' => "alt:{$char}", 'value' => $alt, 'rules' => $this->withPairs($rules, $altPairs)];
            }
        }

        $stripped = $this->stripped($folded, $rules);
        if ($stripped !== null && $stripped['value'] !== $base) {
            $variants[] = $stripped;
        }

        $seen = [];

        return array_values(array_filter($variants, function ($variant) use (&$seen) {
            if (isset($seen[$variant['value']])) {
                return false;
            }

            return $seen[$variant['value']] = true;
        }));
    }

    /**
     * Lowercase, NFKC and homoglyph folding; the rules say what changed.
     *
     * @return array{0: string, 1: list<array<string, mixed>>}
     */
    private function fold(string $value): array
    {
        $lower = mb_strtolower(trim(preg_replace('/^@+/u', '', trim($value)) ?? ''));
        $folded = mb_strtolower($this->nfkc($lower));
        $folded = $this->homoglyphs === [] ? $folded : strtr($folded, $this->homoglyphs);

        return [$folded, $folded !== $lower ? [['rule' => 'unicode_folded']] : []];
    }

    /**
     * Confusables mapped, then everything but letters and digits dropped.
     *
     * @param  array<string, string>  $override  readings that replace the primary ones
     * @return array{0: string, 1: list<string>} the cleaned name and the "a→b" pairs that were applied
     */
    private function clean(string $folded, array $override = []): array
    {
        [$mapped, $pairs] = $this->map($folded, $override);

        return [preg_replace('/[^\p{L}\p{N}]+/u', '', $mapped) ?? '', $pairs];
    }

    /**
     * @param  array<string, string>  $override
     * @return array{0: string, 1: list<string>}
     */
    private function map(string $folded, array $override = []): array
    {
        $table = $override + $this->confusables;
        $pairs = [];
        foreach ($table as $from => $to) {
            if (str_contains($folded, (string) $from)) {
                $pairs[] = "{$from}→{$to}";
            }
        }

        return [$table === [] ? $folded : strtr($folded, $table), $pairs];
    }

    /**
     * The base without trailing digits and without an affix at either end, or null when nothing was stripped.
     *
     * @param  list<array<string, mixed>>  $foldRules
     * @return array{key: string, value: string, rules: list<array<string, mixed>>}|null
     */
    private function stripped(string $folded, array $foldRules): ?array
    {
        $rules = $foldRules;
        $work = $folded;

        if (preg_match('/[\s_.\-]*(\d+)$/u', $work, $m) === 1) {
            $without = preg_replace('/[\s_.\-]*\d+$/u', '', $work) ?? $work;
            if (mb_strlen($this->clean($without)[0]) >= self::MIN_REMAINING_DIGITS) {
                $work = $without;
                $rules[] = ['rule' => 'trailing_digits_stripped', 'value' => $m[1]];
            }
        }

        [$cleaned, $pairs] = $this->clean($work);
        $value = $cleaned;
        foreach (['prefix', 'suffix'] as $position) {
            foreach ($this->affixes as $affix) {
                $hit = $position === 'prefix' ? str_starts_with($value, $affix) : str_ends_with($value, $affix);
                $rest = $position === 'prefix' ? mb_substr($value, mb_strlen($affix)) : mb_substr($value, 0, mb_strlen($value) - mb_strlen($affix));
                if ($hit && mb_strlen($rest) >= self::MIN_REMAINING) {
                    $value = $rest;
                    $rules[] = ['rule' => 'affix_stripped', 'value' => $affix, 'position' => $position];
                    break;
                }
            }
        }

        if ($rules === $foldRules || mb_strlen($value) < self::MIN_LENGTH) {
            return null;
        }

        return ['key' => 'stripped', 'value' => $value, 'rules' => $this->withPairs($rules, $pairs)];
    }

    /**
     * @param  list<array<string, mixed>>  $rules
     * @param  list<string>  $pairs
     * @return list<array<string, mixed>>
     */
    private function withPairs(array $rules, array $pairs): array
    {
        return $pairs === [] ? $rules : [...$rules, ['rule' => 'confusable_chars', 'pairs' => $pairs]];
    }

    private function nfkc(string $value): string
    {
        if (! class_exists(Normalizer::class)) {
            if (! self::$warnedNoIntl) {
                self::$warnedNoIntl = true;
                Log::warning('detection.impersonation.no_intl', ['message' => 'ext-intl is missing: names are not NFKC-normalized.']);
            }

            return $value;
        }

        return Normalizer::normalize($value, Normalizer::FORM_KC) ?: $value;
    }
}
