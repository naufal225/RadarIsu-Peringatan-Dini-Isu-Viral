<?php

namespace Tests\Unit\Detection;

use App\Services\Detection\AccountNameNormalizer;
use PHPUnit\Framework\TestCase;

/**
 * Normalization of account names before pg_trgm compares them (F13, prompt: lowercase, NFKC, separators,
 * look-alike mapping, common affixes). Pure; the tables are the shipped config/impersonation.php.
 */
class AccountNameNormalizerTest extends TestCase
{
    private AccountNameNormalizer $normalizer;

    protected function setUp(): void
    {
        $this->normalizer = new AccountNameNormalizer(require __DIR__.'/../../../config/impersonation.php');
    }

    /** @return array<string, string> variant key => value */
    private function values(string $name): array
    {
        return array_column($this->normalizer->variants($name), 'value', 'key');
    }

    /** @return list<string> */
    private function ruleNames(string $name, string $key = 'base'): array
    {
        $variant = collect($this->normalizer->variants($name))->firstWhere('key', $key);

        return array_map(fn ($r) => $r['rule'], $variant['rules'] ?? []);
    }

    public function test_lowercase_and_leading_at_are_dropped(): void
    {
        $this->assertSame('kodamcontoh', $this->normalizer->normalize('@KodamContoh'));
        $this->assertSame('kodamcontoh', $this->normalizer->normalize('  @@kodamcontoh '));
    }

    public function test_separators_and_spaces_are_removed_and_reported(): void
    {
        foreach (['kodam_contoh', 'kodam.contoh', 'kodam-contoh', 'Kodam Contoh', 'KODAM__CONTOH'] as $name) {
            $this->assertSame('kodamcontoh', $this->normalizer->normalize($name), $name);
        }
        $this->assertContains('separators_removed', $this->ruleNames('kodam_contoh'));
        $this->assertNotContains('separators_removed', $this->ruleNames('kodamcontoh'));
    }

    public function test_look_alike_digits_and_symbols_are_mapped(): void
    {
        $this->assertSame('kodamcontoh', $this->normalizer->normalize('k0dam_c0nt0h'));
        $this->assertSame('kodamsatu', $this->normalizer->normalize('kodam5atu'));
        $this->assertSame('kodamasli', $this->normalizer->normalize('kod@mas1i')); // @ -> a, 1 -> l
        $this->assertSame('kodam', $this->normalizer->normalize('kodarn'));       // rn -> m
        $this->assertSame('kowa', $this->normalizer->normalize('kovva'));         // vv -> w
    }

    public function test_the_mapping_is_reported_as_pairs(): void
    {
        $variant = $this->normalizer->variants('k0dam')[0];

        $this->assertSame([['rule' => 'confusable_chars', 'pairs' => ['0→o']]], $variant['rules']);
    }

    public function test_one_can_be_read_as_i_as_well_as_l(): void
    {
        $values = $this->values('mas1d');

        $this->assertSame('masld', $values['base']);   // 1 read as l
        $this->assertSame('masid', $values['alt:1']);  // 1 read as i
    }

    public function test_unicode_forms_are_folded_with_nfkc(): void
    {
        $this->assertSame('kodamcontoh', $this->normalizer->normalize('ＫＯＤＡＭ　ＣＯＮＴＯＨ')); // fullwidth
        $this->assertContains('unicode_folded', $this->ruleNames('ＫＯＤＡＭcontoh'));
    }

    public function test_cyrillic_and_greek_look_alikes_become_latin(): void
    {
        $this->assertSame('kodamcontoh', $this->normalizer->normalize('kоdаm_cоntоh')); // Cyrillic о and а
        $this->assertSame('apple', $this->normalizer->normalize('αррle'));              // Greek alpha, Greek rho
    }

    public function test_trailing_digits_make_a_stripped_reading(): void
    {
        $values = $this->values('kodam_contoh2024');

        $this->assertSame('kodamcontoh2o2a', $values['base']); // the digits are mapped too (0 -> o, 4 -> a)
        $this->assertSame('kodamcontoh', $values['stripped']);
        $this->assertContains('trailing_digits_stripped', $this->ruleNames('kodam_contoh2024', 'stripped'));
    }

    public function test_affixes_at_either_end_make_a_stripped_reading(): void
    {
        $this->assertSame('kodamcontoh', $this->values('kodam_contoh_official')['stripped']);
        $this->assertSame('kodamcontoh', $this->values('resmi.kodam.contoh')['stripped']);
        $this->assertSame('kodamcontoh', $this->values('kodamcontoh_id')['stripped']);
        $this->assertSame('kodamcontoh', $this->values('real_kodam_contoh')['stripped']);
    }

    public function test_the_affix_rule_records_the_word_and_the_side(): void
    {
        $stripped = collect($this->normalizer->variants('kodam_contoh_official'))->firstWhere('key', 'stripped');

        $this->assertContains(['rule' => 'affix_stripped', 'value' => 'official', 'position' => 'suffix'], $stripped['rules']);
    }

    public function test_digits_then_affix_are_both_stripped(): void
    {
        $this->assertSame('kodamcontoh', $this->values('kodam_contoh_official99')['stripped']);
    }

    public function test_an_affix_in_the_middle_is_not_stripped(): void
    {
        $this->assertArrayNotHasKey('stripped', $this->values('kodamofficialcontoh'));
    }

    public function test_an_affix_is_not_stripped_when_too_little_is_left(): void
    {
        $this->assertArrayNotHasKey('stripped', $this->values('rapid'));   // "rap" is 3 < 4
        $this->assertArrayNotHasKey('stripped', $this->values('alid'));
        $this->assertArrayNotHasKey('stripped', $this->values('x_official')); // "x"
    }

    public function test_a_name_without_decoration_has_only_the_base(): void
    {
        $this->assertSame(['base' => 'kodamcontoh'], $this->values('kodamcontoh'));
    }

    public function test_too_short_names_have_no_readings(): void
    {
        $this->assertSame([], $this->normalizer->variants('ab'));
        $this->assertSame([], $this->normalizer->variants('_a_'));
        $this->assertSame([], $this->normalizer->variants(''));
        $this->assertSame([], $this->normalizer->variants('@'));
        $this->assertSame('', $this->normalizer->normalize('  '));
    }

    public function test_identical_readings_are_listed_once(): void
    {
        $variants = $this->normalizer->variants('kodam_contoh');

        $this->assertCount(1, $variants);
    }

    public function test_a_name_made_only_of_digits_does_not_crash(): void
    {
        $this->assertIsArray($this->normalizer->variants('123456'));
        $this->assertIsArray($this->normalizer->variants('2024'));
    }

    public function test_the_mapping_tables_can_be_extended_by_config(): void
    {
        $custom = new AccountNameNormalizer(['confusables' => ['9' => 'g'], 'affixes' => ['palsu']]);

        $this->assertSame('kodamg', $custom->normalize('kodam9'));
        $this->assertSame('kodamcontoh', collect($custom->variants('kodam_contoh_palsu'))->firstWhere('key', 'stripped')['value']);
    }

    public function test_the_same_name_gives_the_same_result(): void
    {
        $this->assertSame($this->normalizer->variants('K0dam_Contoh_Official1'), $this->normalizer->variants('K0dam_Contoh_Official1'));
    }

    public function test_emoji_and_symbols_are_dropped(): void
    {
        $this->assertSame('kodamcontoh', $this->normalizer->normalize('Kodam ✅ Contoh 🇮🇩'));
    }
}
