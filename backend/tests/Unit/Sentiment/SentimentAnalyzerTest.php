<?php

namespace Tests\Unit\Sentiment;

use App\Services\Detection\SentimentAnalyzer;
use PHPUnit\Framework\TestCase;

class SentimentAnalyzerTest extends TestCase
{
    protected function tearDown(): void
    {
        SentimentAnalyzer::resetLexiconCache();
        parent::tearDown();
    }

    public function test_normalizes_text_according_to_prd(): void
    {
        $raw = "  HEBAT!! Kunjungi https://tni.mil.id/berita dan follow @puspentni... Prajurit JUARA!!  ";
        $normalized = SentimentAnalyzer::normalizeText($raw);

        $this->assertSame('hebat kunjungi dan follow prajurit juara', $normalized);
    }

    public function test_strips_various_urls_and_mentions(): void
    {
        $text = "Beredar di http://bit.ly/xyz atau www.situspalsu.com dari @provokator_123 : fitnah keji!";
        $normalized = SentimentAnalyzer::normalizeText($text);

        $this->assertSame('beredar di atau dari fitnah keji', $normalized);
    }

    public function test_classifies_positive_sentiment_with_custom_lexicon(): void
    {
        $lexicon = [
            'hebat' => 1.0,
            'juara' => 1.0,
            'prestasi' => 1.0,
        ];

        $result = SentimentAnalyzer::classify('Prajurit hebat dan juara berprestasi', $lexicon);

        $this->assertSame('positive', $result['label']);
        $this->assertEquals(1.0, $result['score']);
        $this->assertArrayHasKey('hebat', $result['matched_terms']);
    }

    public function test_classifies_negative_sentiment_with_custom_lexicon(): void
    {
        $lexicon = [
            'hoaks' => -1.0,
            'fitnah' => -1.0,
            'bohong' => -1.0,
        ];

        $result = SentimentAnalyzer::classify('Beredar hoaks dan fitnah bohong', $lexicon);

        $this->assertSame('negative', $result['label']);
        $this->assertEquals(-1.0, $result['score']);
        $this->assertArrayHasKey('hoaks', $result['matched_terms']);
    }

    public function test_classifies_neutral_when_no_lexicon_terms_match(): void
    {
        $lexicon = [
            'bagus' => 1.0,
            'buruk' => -1.0,
        ];

        $result = SentimentAnalyzer::classify('Hari ini cuaca cerah berawan', $lexicon);

        $this->assertSame('neutral', $result['label']);
        $this->assertEquals(0.0, $result['score']);
        $this->assertEmpty($result['matched_terms']);
    }

    public function test_classifies_neutral_when_balanced_around_zero(): void
    {
        $lexicon = [
            'bagus' => 1.0,
            'buruk' => -1.0,
            'rata' => 0.0,
        ];

        // 1 positive, 1 negative => average 0.0 => neutral
        $result = SentimentAnalyzer::classify('Kondisi ada yang bagus dan ada yang buruk', $lexicon);

        $this->assertSame('neutral', $result['label']);
        $this->assertEquals(0.0, $result['score']);
    }

    public function test_respects_threshold_boundaries(): void
    {
        $lexicon = [
            'a' => 1.0,
            'b' => 0.0,
            'c' => 0.0,
            'd' => 0.0,
            'e' => 0.0,
        ];

        // Kata netral tidak ikut dihitung: satu kata +1 di antara empat kata netral => skor 1.0.
        $result = SentimentAnalyzer::classify('a b c d e', $lexicon);
        $this->assertSame('positive', $result['label']);
        $this->assertEquals(1.0, $result['score']);

        $lexiconNeg = [
            'a' => -1.0,
            'b' => 0.0,
            'c' => 0.0,
            'd' => 0.0,
            'e' => 0.0,
        ];

        $resultNeg = SentimentAnalyzer::classify('a b c d e', $lexiconNeg);
        $this->assertSame('negative', $resultNeg['label']);
        $this->assertEquals(-1.0, $resultNeg['score']);

        // Batas ambang pada bobot kata bermuatan tunggal.
        $atThreshold = SentimentAnalyzer::classify('x', ['x' => 0.2]);
        $this->assertSame('positive', $atThreshold['label']);
        $this->assertEquals(0.2, $atThreshold['score']);

        $belowThreshold = SentimentAnalyzer::classify('x', ['x' => 0.19]);
        $this->assertSame('neutral', $belowThreshold['label']);
    }

    public function test_neutral_terms_do_not_dilute_the_score(): void
    {
        $lexicon = [
            'bagus' => 1.0,
            'warga' => 0.0,
            'jadwal' => 0.0,
            'institusi' => 0.0,
        ];

        $result = SentimentAnalyzer::classify('Warga menanyakan jadwal institusi, hasilnya bagus', $lexicon);
        $this->assertSame('positive', $result['label']);
        $this->assertEquals(1.0, $result['score']);

        // Hanya kata netral yang cocok: label netral, tetapi kata yang cocok tetap tercatat.
        $onlyNeutral = SentimentAnalyzer::classify('Warga menanyakan jadwal institusi', $lexicon);
        $this->assertSame('neutral', $onlyNeutral['label']);
        $this->assertEquals(0.0, $onlyNeutral['score']);
        $this->assertArrayHasKey('warga', $onlyNeutral['matched_terms']);
    }

    public function test_handles_multi_word_terms_without_double_counting(): void
    {
        $lexicon = [
            'bocor' => -1.0,
            'kebocoran rahasia' => -1.0,
            'rahasia' => 0.0,
            'aman' => 1.0,
        ];

        $result = SentimentAnalyzer::classify('Terjadi kebocoran rahasia di sistem yang aman', $lexicon);

        // 'kebocoran rahasia' (-1) + 'aman' (1) => score = 0.0 => neutral
        $this->assertArrayHasKey('kebocoran rahasia', $result['matched_terms']);
        $this->assertArrayNotHasKey('rahasia', $result['matched_terms']); // masked
        $this->assertEquals(0.0, $result['score']);
    }

    public function test_loads_default_indonesian_sentiment_csv(): void
    {
        $dict = SentimentAnalyzer::getLexicon();

        $this->assertNotEmpty($dict);
        $this->assertArrayHasKey('hebat', $dict);
        $this->assertArrayHasKey('hoaks', $dict);
        $this->assertSame(1.0, $dict['hebat']);
        $this->assertSame(-1.0, $dict['hoaks']);
    }

    public function test_real_world_social_media_posts_in_indonesian(): void
    {
        // 1. Positive institution post
        $posText = "Apresiasi setinggi-tingginya untuk prajurit TNI AD yang sigap, tangguh, dan berbakti melindungi kedaulatan NKRI!";
        $posResult = SentimentAnalyzer::classify($posText);
        $this->assertSame('positive', $posResult['label']);
        $this->assertGreaterThanOrEqual(0.2, $posResult['score']);

        // 2. Negative cyber-social attack post
        $negText = "Hati-hati beredar hoaks dan fitnah keji dari akun palsu yang mencoba memprovokasi kerusuhan dan perpecahan!";
        $negResult = SentimentAnalyzer::classify($negText);
        $this->assertSame('negative', $negResult['label']);
        $this->assertLessThanOrEqual(-0.2, $negResult['score']);

        // 3. Neutral administrative post
        $neuText = "Jadwal rapat evaluasi kegiatan apel gabungan akan diselenggarakan di aula markas pada hari Senin.";
        $neuResult = SentimentAnalyzer::classify($neuText);
        $this->assertSame('neutral', $neuResult['label']);
        $this->assertEquals(0.0, $neuResult['score']);
    }

    public function test_handles_empty_or_symbol_only_inputs_cleanly(): void
    {
        $empty = SentimentAnalyzer::classify('');
        $this->assertSame('neutral', $empty['label']);
        $this->assertEquals(0.0, $empty['score']);
        $this->assertEmpty($empty['matched_terms']);

        $symbolsOnly = SentimentAnalyzer::classify('!!! ??? @#$% https://example.com @user');
        $this->assertSame('neutral', $symbolsOnly['label']);
        $this->assertEquals(0.0, $symbolsOnly['score']);
    }

    public function test_high_volume_throughput_performance(): void
    {
        $posts = [
            "Prajurit hebat menjaga kedaulatan bangsa dan negara secara profesional",
            "Beredar fitnah keji dan hoaks provokasi di media sosial",
            "Jadwal apel dan apel gabungan hari ini di markas",
            "Mendukung penuh TNI AD untuk menjaga persatuan dan kesatuan",
        ];

        $start = microtime(true);
        for ($i = 0; $i < 500; $i++) {
            $post = $posts[$i % 4];
            $result = SentimentAnalyzer::classify($post);
            $this->assertNotEmpty($result['label']);
        }
        $elapsed = microtime(true) - $start;

        // 500 classifications should complete under 0.5 seconds with pre-cached dictionary
        $this->assertLessThan(0.5, $elapsed, "SentimentAnalyzer throughput is too slow: {$elapsed}s for 500 posts");
    }
}
