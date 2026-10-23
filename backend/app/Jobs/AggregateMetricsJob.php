<?php

namespace App\Jobs;

use App\Services\Detection\MetricsAggregator;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Recomputes the given (topic, hour) pairs of metrics_hourly (PRD §10.1).
 */
class AggregateMetricsJob implements ShouldQueue
{
    use Queueable;

    /** PRD §13: failed jobs are retried 3 times, then listed in failed_jobs. */
    public int $tries = 3;

    /**
     * @param  list<array{0: int, 1: string}>  $pairs  [topic_id, hour 'Y-m-d H:00:00' UTC]
     */
    public function __construct(public array $pairs) {}

    public function handle(MetricsAggregator $aggregator): void
    {
        $aggregator->recompute($this->pairs);
    }
}
