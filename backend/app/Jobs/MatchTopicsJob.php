<?php

namespace App\Jobs;

use App\Models\Topic;
use App\Services\Detection\MetricsAggregator;
use App\Services\Detection\TopicMatcher;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Two modes (PRD §10.1):
 *  - posts: match freshly normalized posts to every active topic, then queue the affected hours;
 *  - topic: a topic was created, changed or reactivated, so match every stored post against it again
 *    and rebuild its metrics (see forTopic()).
 */
class MatchTopicsJob implements ShouldQueue
{
    use Queueable;

    /** PRD §13: failed jobs are retried 3 times, then listed in failed_jobs. */
    public int $tries = 3;

    /**
     * @param  list<int>  $postIds
     */
    public function __construct(public array $postIds = [], public ?int $topicId = null) {}

    public static function forTopic(Topic $topic): self
    {
        return new self([], $topic->id);
    }

    public function handle(TopicMatcher $matcher, MetricsAggregator $aggregator): void
    {
        if ($this->topicId !== null) {
            $topic = Topic::find($this->topicId);
            // An inactive topic keeps its history and is not matched until it is activated again.
            if ($topic === null || ! $topic->is_active) {
                return;
            }

            $matcher->rematch($topic);
            $aggregator->rebuildTopic($topic->id);

            return;
        }

        $pairs = $matcher->matchPosts($this->postIds);
        if ($pairs !== []) {
            AggregateMetricsJob::dispatch($pairs);
        }
    }
}
