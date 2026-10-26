<?php

namespace App\Console\Commands;

use App\Models\Topic;
use App\Services\Detection\DataClock;
use App\Services\Detection\MetricsAggregator;
use Illuminate\Console\Command;

/**
 * `radarisu:aggregate` (PRD §10.2): the safety net behind AggregateMetricsJob. Normally the jobs keep
 * metrics_hourly current; this recomputes a recent window in case one was lost, and `--all` rebuilds it.
 */
class AggregateMetrics extends Command
{
    protected $signature = 'radarisu:aggregate
        {--hours=48 : Recompute the hours of posts from the last N hours}
        {--topic= : Only this topic id}
        {--all : Rebuild every hour of every topic, dropping hours without matching posts}';

    protected $description = 'Recompute metrics_hourly from topic matches';

    public function handle(MetricsAggregator $aggregator): int
    {
        $topicId = $this->option('topic');
        if ($topicId !== null && ! (ctype_digit((string) $topicId) && Topic::whereKey((int) $topicId)->exists())) {
            $this->error("Topic [$topicId] not found.");

            return self::FAILURE;
        }
        $topicId = $topicId === null ? null : (int) $topicId;

        if ($this->option('all')) {
            $topicId === null ? $aggregator->rebuildAll() : $aggregator->rebuildTopic($topicId);
            $this->info('Metrics rebuilt'.($topicId === null ? '.' : " for topic $topicId."));

            return self::SUCCESS;
        }

        $hours = $this->option('hours');
        if (! ctype_digit((string) $hours) || (int) $hours < 1) {
            $this->error('--hours must be a positive integer.');

            return self::FAILURE;
        }

        // The data clock, so a replay (virtual time) is recomputed around its own "now".
        $aggregator->recomputeSince(DataClock::now()->subHours((int) $hours), $topicId);
        $this->info("Metrics recomputed for the last $hours hours.");

        return self::SUCCESS;
    }
}
