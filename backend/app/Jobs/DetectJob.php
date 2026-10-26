<?php

namespace App\Jobs;

use App\Services\Detection\IssueDetectionService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/**
 * One detection pass (PRD §10.1, §10.2: every minute from `radarisu:detect`): the spike (F3) and
 * coordination (F4) detectors raise `issue` alerts; the impersonation detector (F13) joins the same pass.
 *
 * Unique while queued or running, so a slow pass is never overlapped by the next minute's dispatch.
 * Idempotent: windows come from the data clock and every write is an upsert.
 */
class DetectJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    /** PRD §13: failed jobs are retried 3 times, then listed in failed_jobs. */
    public int $tries = 3;

    /** @var list<int> seconds between retries */
    public array $backoff = [10, 30, 60];

    public int $timeout = 240;

    /** Releases the unique lock if a worker dies mid-run, so detection cannot stall for good. */
    public int $uniqueFor = 300;

    public function uniqueId(): string
    {
        return 'detect';
    }

    public function handle(IssueDetectionService $issues): void
    {
        $stats = $issues->run();

        Log::info('detection.pass', ['detector' => 'issue'] + $stats);

        if ($stats['failed'] > 0) {
            // Topics that worked are already written; the retry only has to redo the failed ones.
            throw new RuntimeException("Issue detection failed for {$stats['failed']} topic(s).");
        }
    }

    public function failed(?Throwable $exception): void
    {
        Log::error('detection.pass_failed', [
            'job' => static::class,
            'exception' => $exception ? $exception::class : null,
            'message' => $exception?->getMessage(),
        ]);
    }
}
