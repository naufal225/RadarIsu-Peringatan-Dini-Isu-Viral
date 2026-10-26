<?php

/*
 * Tables for the impersonation detector (F13, PRD §10.7). They only change how account names are
 * normalized before pg_trgm compares them; the thresholds (impersonation_threshold, young_account_days,
 * impersonation_window_hours, severity cutoffs) live in the `settings` table (/admin/settings).
 *
 * Add a line to extend a table. Keys are matched after lowercasing and Unicode NFKC, longest key first.
 * The same mapping is applied to the official accounts, so it only needs to make look-alikes meet, not
 * to be "correct" spelling: with rn -> m both "rnodern" and "modern" fold to the same string.
 */

return [

    /*
     * Characters (and short sequences) people swap for look-alike letters. Applied before separators
     * are dropped, so symbols such as "@" and "$" can still be mapped.
     */
    'confusables' => [
        'rn' => 'm',
        'vv' => 'w',
        '0' => 'o',
        '1' => 'l',
        '3' => 'e',
        '4' => 'a',
        '5' => 's',
        '7' => 't',
        '8' => 'b',
        '@' => 'a',
        '$' => 's',
        '!' => 'i',
        '|' => 'l',
    ],

    /*
     * A character with more than one plausible reading. The primary reading is in `confusables`; each
     * entry here makes one extra variant of the name with the alternative reading, e.g. 1 as i.
     */
    'alternatives' => [
        '1' => 'i',
    ],

    /*
     * Cyrillic and Greek letters that look like Latin ones. NFKC does not fold these.
     */
    'homoglyphs' => [
        'а' => 'a', 'е' => 'e', 'о' => 'o', 'р' => 'p', 'с' => 'c', 'х' => 'x', 'у' => 'y',
        'і' => 'i', 'ѕ' => 's', 'ј' => 'j', 'һ' => 'h', 'ԁ' => 'd', 'ԛ' => 'q', 'ɡ' => 'g',
        'ο' => 'o', 'α' => 'a', 'ν' => 'v', 'ρ' => 'p', 'τ' => 't', 'ι' => 'i', 'κ' => 'k',
        'ı' => 'i',
    ],

    /*
     * Words added to a name to make it look official or like a second account. Stripped from the
     * start or the end of a name as an extra reading of it (never from the middle), and only when at
     * least AccountNameNormalizer::MIN_REMAINING characters stay.
     */
    'affixes' => [
        'official', 'ofc', 'resmi', 'asli', 'real', 'original', 'ori', 'verified', 'id',
    ],

];
