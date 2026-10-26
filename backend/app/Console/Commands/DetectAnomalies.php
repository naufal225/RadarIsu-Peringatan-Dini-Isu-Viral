<?php

namespace App\Console\Commands;

use App\Jobs\DetectJob;
use Illuminate\Console\Command;

/**
 * `radarisu:detect` (PRD §10.2): queues one detection pass, scheduled every minute. `--sync` runs it
 * in the foreground, for a demo or a manual check.
 */
class DetectAnomalies extends Command
{
    protected $signature = 'radarisu:detect {--sync : Run the pass now instead of queueing it}';

    protected $description = 'Run the detectors (spike) over the current data window';

    public function handle(): int
    {
        if ($this->option('sync')) {
            DetectJob::dispatchSync();
            $this->info('Detection pass finished.');

            return self::SUCCESS;
        }

        DetectJob::dispatch();
        $this->info('Detection pass queued.');

        return self::SUCCESS;
    }
}
