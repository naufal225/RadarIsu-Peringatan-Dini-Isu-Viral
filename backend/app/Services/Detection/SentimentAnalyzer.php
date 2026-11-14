<?php

namespace App\Services\Detection;

class SentimentAnalyzer
{
    public const DEFAULT_POS_THRESHOLD = 0.2;
    public const DEFAULT_NEG_THRESHOLD = -0.2;

    /**
     * In-memory cache of the loaded lexicon dictionary.
     * Format: [term => float polarity]
     *
     * @var array<string, float>|null
     */
    protected static ?array $cachedLexicon = null;

    /**
     * Pre-indexed and sorted multi-word phrases for fast matching.
     *
     * @var array<string, float>|null
     */
    protected static ?array $cachedMultiWords = null;

    /**
     * Pre-indexed single words for O(1) hash lookup.
     *
     * @var array<string, float>|null
     */
    protected static ?array $cachedSingleWords = null;

    /**
     * Custom path to lexicon CSV if overridden.
     */
    protected static ?string $customLexiconPath = null;

    /**
     * Classify the sentiment of a text into a label and score.
     * Pure function contract according to docs/CONTRACTS.md:
     * SentimentAnalyzer::classify(text) -> ['label' => ..., 'score' => ...]
     *
     * @param string $text Raw or normalized post text
     * @param array<string, float>|null $lexicon Optional custom dictionary for testing
     * @param float $posThreshold Positive threshold (default: >= 0.2)
     * @param float $negThreshold Negative threshold (default: <= -0.2)
     * @return array{label: string, score: float, matched_terms: array<string, float>}
     */
    public static function classify(
        string $text,
        ?array $lexicon = null,
        float $posThreshold = self::DEFAULT_POS_THRESHOLD,
        float $negThreshold = self::DEFAULT_NEG_THRESHOLD
    ): array {
        $dict = $lexicon ?? static::getLexicon();
        $normalized = static::normalizeText($text);

        if ($normalized === '' || empty($dict)) {
            return [
                'label' => 'neutral',
                'score' => 0.0,
                'matched_terms' => [],
            ];
        }

        $matchedTerms = static::findMatchedTerms($normalized, $lexicon);

        if (empty($matchedTerms)) {
            return [
                'label' => 'neutral',
                'score' => 0.0,
                'matched_terms' => [],
            ];
        }

        // Rata-rata hanya dari kata bermuatan (polaritas ≠ 0). Kata netral tidak menurunkan skor:
        // tanpa ini satu kata positif di antara banyak kata netral tidak pernah mencapai ambang 0,2.
        $polar = array_filter($matchedTerms, static fn (float $polarity): bool => $polarity !== 0.0);

        if (empty($polar)) {
            return [
                'label' => 'neutral',
                'score' => 0.0,
                'matched_terms' => $matchedTerms,
            ];
        }

        $score = round(array_sum($polar) / count($polar), 3);

        if ($score >= $posThreshold) {
            $label = 'positive';
        } elseif ($score <= $negThreshold) {
            $label = 'negative';
        } else {
            $label = 'neutral';
        }

        return [
            'label' => $label,
            'score' => $score,
            'matched_terms' => $matchedTerms,
        ];
    }

    /**
     * Normalization according to PRD §10.4:
     * - Huruf kecil (lowercase)
     * - Hapus URL
     * - Hapus mention (@username)
     * - Ganti tanda baca beruntun / tanda baca dengan spasi
     * - Ringkas spasi (trim dan hapus spasi berlebih)
     */
    public static function normalizeText(string $text): string
    {
        // 1. Lowercase (UTF-8)
        $text = mb_strtolower($text, 'UTF-8');

        // 2. Hapus URL (http://, https://, www.)
        $text = preg_replace('/https?:\/\/\S+|www\.\S+/u', ' ', $text) ?? $text;

        // 3. Hapus mention (@user, @satuan_tni)
        $text = preg_replace('/@[\w.-]+/u', ' ', $text) ?? $text;

        // 4. Ganti tanda baca beruntun dan karakter non-alfanumerik dengan spasi
        $text = preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $text) ?? $text;

        // 5. Ringkas spasi ganda dan trim
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;

        return trim($text);
    }

    /**
     * Match lexicon terms in normalized text.
     * Prioritizes longer/multi-word terms first to avoid double counting with negation or sub-terms.
     *
     * @param string $normalized
     * @param array<string, float>|null $customLexicon
     * @return array<string, float> Matched [term => polarity]
     */
    protected static function findMatchedTerms(string $normalized, ?array $customLexicon = null): array
    {
        $matched = [];
        $workingText = ' ' . $normalized . ' ';

        if ($customLexicon !== null) {
            [$multiWords, $singleWords] = static::prepareDictionary($customLexicon);
        } else {
            [$multiWords, $singleWords] = static::getPreparedDefaultLexicon();
        }

        // 1. Match multi-word phrases first (guarded by fast str_contains check)
        foreach ($multiWords as $phrase => $polarity) {
            if (!str_contains($workingText, $phrase)) {
                continue;
            }
            $pattern = '/(?<=^|\s)' . preg_quote($phrase, '/') . '(?=\s|$)/u';
            if (preg_match($pattern, $workingText)) {
                $matched[$phrase] = $polarity;
                // Mask the matched phrase with whitespace so contained single words are not matched twice
                $workingText = preg_replace($pattern, ' ', $workingText) ?? $workingText;
            }
        }

        // 2. Tokenize remaining words for single-word matching
        $tokens = preg_split('/\s+/u', trim($workingText), -1, PREG_SPLIT_NO_EMPTY);
        if ($tokens !== false) {
            foreach ($tokens as $token) {
                if (isset($singleWords[$token])) {
                    // Record match. If repeated in text, it contributes to overall polarity
                    $matched[$token . '#' . count($matched)] = $singleWords[$token];
                }
            }
        }

        // Clean up internal disambiguation keys for output
        $cleanMatched = [];
        foreach ($matched as $key => $polarity) {
            $termName = preg_replace('/#\d+$/', '', $key);
            $cleanMatched[$termName] = $polarity;
        }

        return $cleanMatched;
    }

    /**
     * Prepare dictionary by separating into multi-word and single-word maps,
     * sorting multi-words descending by character length.
     *
     * @param array<string, float> $dict
     * @return array{0: array<string, float>, 1: array<string, float>} [multiWords, singleWords]
     */
    protected static function prepareDictionary(array $dict): array
    {
        $multiWords = [];
        $singleWords = [];

        foreach ($dict as $term => $polarity) {
            $trimmedTerm = trim($term);
            if ($trimmedTerm === '') {
                continue;
            }
            if (str_contains($trimmedTerm, ' ')) {
                $multiWords[$trimmedTerm] = (float) $polarity;
            } else {
                $singleWords[$trimmedTerm] = (float) $polarity;
            }
        }

        uksort($multiWords, fn ($a, $b) => mb_strlen($b) <=> mb_strlen($a));

        return [$multiWords, $singleWords];
    }

    /**
     * Get or build prepared default lexicon maps.
     *
     * @return array{0: array<string, float>, 1: array<string, float>}
     */
    protected static function getPreparedDefaultLexicon(): array
    {
        if (static::$cachedMultiWords !== null && static::$cachedSingleWords !== null) {
            return [static::$cachedMultiWords, static::$cachedSingleWords];
        }

        $dict = static::getLexicon();
        [$multiWords, $singleWords] = static::prepareDictionary($dict);

        static::$cachedMultiWords = $multiWords;
        static::$cachedSingleWords = $singleWords;

        return [$multiWords, $singleWords];
    }

    /**
     * Load the sentiment lexicon from CSV file (resources/lexicon/id_sentiment.csv).
     *
     * @param string|null $path
     * @return array<string, float>
     */
    public static function getLexicon(?string $path = null): array
    {
        if ($path !== null) {
            return static::loadCsv($path);
        }

        if (static::$cachedLexicon !== null) {
            return static::$cachedLexicon;
        }

        $defaultPath = static::$customLexiconPath;
        if ($defaultPath === null) {
            $base = dirname(__DIR__, 3);
            $candidate = $base . '/resources/lexicon/id_sentiment.csv';
            if (file_exists($candidate)) {
                $defaultPath = $candidate;
            } elseif (function_exists('app') && app() instanceof \Illuminate\Contracts\Foundation\Application && function_exists('base_path')) {
                try {
                    $defaultPath = base_path('resources/lexicon/id_sentiment.csv');
                } catch (\Throwable) {
                    $defaultPath = $candidate;
                }
            } else {
                $defaultPath = $candidate;
            }
        }

        static::$cachedLexicon = static::loadCsv($defaultPath);

        return static::$cachedLexicon;
    }

    /**
     * Parse CSV lexicon file.
     *
     * @param string $filePath
     * @return array<string, float>
     */
    public static function loadCsv(string $filePath): array
    {
        if (!file_exists($filePath) || !is_readable($filePath)) {
            return [];
        }

        $dict = [];
        $handle = fopen($filePath, 'r');
        if ($handle === false) {
            return [];
        }

        // Check and skip header if present
        $firstLine = fgetcsv($handle);
        if ($firstLine !== false) {
            // If the first column is not "term", it might be a data row
            if (isset($firstLine[0], $firstLine[1]) && mb_strtolower(trim($firstLine[0])) === 'term') {
                // Header line, proceed to next
            } else {
                if (isset($firstLine[0], $firstLine[1])) {
                    $term = mb_strtolower(trim($firstLine[0]));
                    $dict[$term] = (float) trim($firstLine[1]);
                }
            }
        }

        while (($row = fgetcsv($handle)) !== false) {
            if (count($row) < 2) {
                continue;
            }
            $term = mb_strtolower(trim($row[0]));
            if ($term === '') {
                continue;
            }
            $dict[$term] = (float) trim($row[1]);
        }

        fclose($handle);

        return $dict;
    }

    /**
     * Reset cached lexicon (useful for tests).
     */
    public static function resetLexiconCache(): void
    {
        static::$cachedLexicon = null;
        static::$cachedMultiWords = null;
        static::$cachedSingleWords = null;
        static::$customLexiconPath = null;
    }

    /**
     * Set a custom path for the lexicon file.
     */
    public static function setLexiconPath(?string $path): void
    {
        static::$customLexiconPath = $path;
        static::$cachedLexicon = null;
        static::$cachedMultiWords = null;
        static::$cachedSingleWords = null;
    }
}
