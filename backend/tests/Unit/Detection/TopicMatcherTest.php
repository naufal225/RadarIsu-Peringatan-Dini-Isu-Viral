<?php

namespace Tests\Unit\Detection;

use App\Models\Topic;
use App\Services\Detection\SentimentAnalyzer;
use App\Services\Detection\TopicMatcher;
use Tests\TestCase;

/**
 * Keyword matching rules (docs/PIPELINE.md): whole words or phrases of the normalized text.
 */
class TopicMatcherTest extends TestCase
{
    private TopicMatcher $matcher;

    protected function setUp(): void
    {
        parent::setUp();
        $this->matcher = new TopicMatcher;
    }

    /**
     * @param  list<string>  $keywords
     */
    private function topic(int $id, array $keywords): Topic
    {
        return (new Topic)->forceFill(['id' => $id, 'keywords' => $keywords, 'is_active' => true]);
    }

    /**
     * @param  list<Topic>  $topics
     * @return list<int>
     */
    private function match(string $postText, array $topics): array
    {
        return $this->matcher->topicIdsFor(SentimentAnalyzer::normalizeText($postText), $this->matcher->compile($topics));
    }

    public function test_matches_whole_words_regardless_of_case(): void
    {
        $topics = [$this->topic(1, ['Korupsi'])];

        $this->assertSame([1], $this->match('Kasus KORUPSI besar', $topics));
        $this->assertSame([1], $this->match('korupsi', $topics), 'whole text');
        $this->assertSame([1], $this->match('Marak korupsi!', $topics), 'punctuation is not part of the word');
    }

    public function test_does_not_match_inside_or_around_other_words(): void
    {
        $topics = [$this->topic(1, ['korupsi'])];

        $this->assertSame([], $this->match('korupsinya parah', $topics));
        $this->assertSame([], $this->match('gerakan antikorupsi', $topics));
        $this->assertSame([], $this->match('dikorupsi lagi', $topics));
    }

    public function test_short_keywords_do_not_match_longer_words(): void
    {
        $topics = [$this->topic(1, ['ad'])];

        $this->assertSame([], $this->match('adalah kegiatan rutin', $topics));
        $this->assertSame([1], $this->match('prajurit ad bertugas', $topics));
    }

    public function test_phrases_match_in_order_with_punctuation_ignored(): void
    {
        $topics = [$this->topic(1, ['TNI-AD'])];

        $this->assertSame([1], $this->match('Prajurit tni ad bertugas', $topics));
        $this->assertSame([1], $this->match('TNI, AD hadir', $topics));
        $this->assertSame([], $this->match('tni dan ad hadir', $topics));
    }

    public function test_any_keyword_of_a_topic_is_enough_and_every_matching_topic_is_returned(): void
    {
        $topics = [
            $this->topic(1, ['hoaks', 'disinformasi']),
            $this->topic(2, ['disinformasi']),
            $this->topic(3, ['bansos']),
        ];

        $this->assertSame([1, 2], $this->match('Disinformasi menyebar', $topics));
        $this->assertSame([1], $this->match('hoaks lagi', $topics));
        $this->assertSame([], $this->match('cuaca cerah', $topics));
    }

    public function test_urls_and_mentions_are_gone_from_the_text_and_cannot_match(): void
    {
        $topics = [$this->topic(1, ['korupsi'])];

        $this->assertSame([], $this->match('Baca https://contoh.id/korupsi dari @korupsi', $topics));
    }

    public function test_keywords_that_normalize_to_nothing_are_ignored(): void
    {
        $compiled = $this->matcher->compile([
            $this->topic(1, ['', '   ', '[nama satuan]', '...']),
            $this->topic(2, ['', 'hoaks']),
        ]);

        // "[nama satuan]" normalizes to "nama satuan", the brackets are only caught at the API (PRD §9.8).
        $this->assertSame([1, 2], array_keys($compiled));
        $this->assertSame([' nama satuan '], $compiled[1]);
        $this->assertSame([' hoaks '], $compiled[2]);

        $this->assertSame([], $this->matcher->compile([$this->topic(3, ['', '  ', '!!!'])]));
    }

    public function test_duplicate_keywords_after_normalization_collapse(): void
    {
        $compiled = $this->matcher->compile([$this->topic(1, ['Hoaks', 'hoaks!', ' HOAKS '])]);

        $this->assertSame([' hoaks '], $compiled[1]);
    }
}
