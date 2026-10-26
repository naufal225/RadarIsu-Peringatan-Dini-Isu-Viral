<?php

namespace App\Jobs;

use App\Models\ReplayScenario;
use App\Services\Ingest\ReplayRunner;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Runs one begun replay (PRD §10.10). It lives as long as the scenario does, so it has its own `replay` queue:
 * run a worker for it next to the default one (`php artisan queue:work --queue=replay`), otherwise the
 * pipeline jobs it feeds would wait behind it.
 *
 * Not retried: a half-played scenario is not something to replay again by itself. A failure closes the run
 * (`status=stopped`, `error` filled, clock reset) and the admin starts it again on purpose.
 */
class ReplayScenarioJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    /** Up to the longest the runner can take: 30 virtual days at speed 1 is far beyond any demo, so cap it at a day. */
    public int $timeout = 86_400;

    public function __construct(public int $scenarioId)
    {
        $this->onQueue('replay');
    }

    public function handle(ReplayRunner $runner): void
    {
        $scenario = ReplayScenario::find($this->scenarioId);
        if ($scenario === null || $scenario->status !== 'running') {
            return; // stopped or deleted before the worker picked it up
        }

        $runner->run($scenario);
    }

    public function failed(?Throwable $exception): void
    {
        $scenario = ReplayScenario::find($this->scenarioId);
        if ($scenario !== null) {
            app(ReplayRunner::class)->fail($scenario, $exception ?? new \RuntimeException('Replay job failed.'));
        }
    }
}
