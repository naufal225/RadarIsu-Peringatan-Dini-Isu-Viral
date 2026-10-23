<?php

namespace App\Services\Detection;

use App\Models\Post;
use App\Models\Topic;
use Illuminate\Support\Facades\DB;

/**
 * Matches posts to topics (PRD §10.1). A keyword matches as a whole word or phrase of the
 * normalized text; both sides go through SentimentAnalyzer::normalizeText(), the single
 * implementation of PRD §10.4. See docs/PIPELINE.md for what this does and does not catch.
 */
class TopicMatcher
{
    public const REMATCH_CHUNK = 2000;

    private const INSERT_CHUNK = 1000;

    /**
     * Normalized, space-padded keywords per topic id. Topics left without any usable keyword are dropped.
     *
     * @param  iterable<Topic>  $topics
     * @return array<int, list<string>>
     */
    public function compile(iterable $topics): array
    {
        $compiled = [];
        foreach ($topics as $topic) {
            $needles = [];
            foreach ((array) $topic->keywords as $keyword) {
                $normalized = SentimentAnalyzer::normalizeText((string) $keyword);
                if ($normalized !== '') {
                    $needles[$normalized] = ' '.$normalized.' ';
                }
            }
            if ($needles !== []) {
                $compiled[$topic->id] = array_values($needles);
            }
        }

        return $compiled;
    }

    /**
     * @param  array<int, list<string>>  $compiled  from compile()
     * @return list<int> ids of the topics the text belongs to
     */
    public function topicIdsFor(string $textNorm, array $compiled): array
    {
        $haystack = ' '.$textNorm.' ';
        $ids = [];
        foreach ($compiled as $topicId => $needles) {
            foreach ($needles as $needle) {
                if (str_contains($haystack, $needle)) {
                    $ids[] = $topicId;

                    break;
                }
            }
        }

        return $ids;
    }

    /**
     * Stores the matches of the given posts against every active topic.
     *
     * @param  list<int>  $postIds
     * @return list<array{0: int, 1: string}> affected [topic_id, hour 'Y-m-d H:00:00' UTC] pairs
     */
    public function matchPosts(array $postIds): array
    {
        $compiled = $this->compile(Topic::where('is_active', true)->get());
        if ($compiled === [] || $postIds === []) {
            return [];
        }

        $rows = [];
        $pairs = [];
        foreach (Post::whereIn('id', $postIds)->get(['id', 'text_norm', 'posted_at']) as $post) {
            $hour = $post->posted_at->utc()->format('Y-m-d H:00:00');
            foreach ($this->topicIdsFor($post->text_norm, $compiled) as $topicId) {
                $rows[] = ['post_id' => $post->id, 'topic_id' => $topicId];
                $pairs["$topicId|$hour"] = [$topicId, $hour];
            }
        }

        foreach (array_chunk($rows, self::INSERT_CHUNK) as $chunk) {
            DB::table('topic_matches')->insertOrIgnore($chunk);
        }

        return array_values($pairs);
    }

    /**
     * Replaces all matches of a topic by matching every stored post again (a topic was created,
     * its keywords changed, or it was activated). Metrics are rebuilt separately.
     */
    public function rematch(Topic $topic): void
    {
        DB::transaction(function () use ($topic) {
            DB::table('topic_matches')->where('topic_id', $topic->id)->delete();

            $compiled = $this->compile([$topic]);
            if ($compiled === []) {
                return;
            }

            Post::query()->select(['id', 'text_norm'])->chunkById(self::REMATCH_CHUNK, function ($posts) use ($compiled, $topic) {
                $rows = [];
                foreach ($posts as $post) {
                    if ($this->topicIdsFor($post->text_norm, $compiled) !== []) {
                        $rows[] = ['post_id' => $post->id, 'topic_id' => $topic->id];
                    }
                }
                foreach (array_chunk($rows, self::INSERT_CHUNK) as $chunk) {
                    DB::table('topic_matches')->insert($chunk);
                }
            });
        });
    }
}
