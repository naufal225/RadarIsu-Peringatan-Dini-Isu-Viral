<?php

namespace App\Console\Commands;

use App\Jobs\DetectJob;
use App\Models\ReplayScenario;
use App\Services\Ingest\ReplayRunner;
use App\Services\Ingest\ReplayStateException;
use Illuminate\Console\Command;

/**
 * `radarisu:replay {scenario}` (PRD §10.2): plays a scenario in this process. The API starts the same run in a
 * queue job; this is the way to run it from a terminal, and with `--sync` without waiting (demo and tests).
 */
class ReplayScenarioCommand extends Command
{
    protected $signature = 'radarisu:replay
        {scenario : Scenario id}
        {--speed= : Speed factor (default: the scenario\'s default_speed_factor)}
        {--sync : Do not wait between batches and run detection after each one}';

    protected $description = 'Replay a scenario through the normal pipeline';

    public function handle(ReplayRunner $runner): int
    {
        $scenario = ctype_digit((string) $this->argument('scenario')) ? ReplayScenario::find((int) $this->argument('scenario')) : null;
        if ($scenario === null) {
            $this->error('Scenario ['.$this->argument('scenario').'] not found.');

            return self::FAILURE;
        }

        $speed = $this->option('speed');
        if ($speed !== null && (! ctype_digit((string) $speed) || (int) $speed < 1 || (int) $speed > 100_000)) {
            $this->error('--speed must be an integer between 1 and 100000.');

            return self::FAILURE;
        }

        try {
            $scenario = $runner->begin($scenario, $speed === null ? $scenario->default_speed_factor : (int) $speed);
        } catch (ReplayStateException $e) {
            $this->error('Cannot start: '.$e->getMessage());

            return self::FAILURE;
        }

        $sync = (bool) $this->option('sync');
        if ($sync) {
            // The follow-up jobs (topic matching, metrics) run here too, so no queue worker has to be up.
            app('queue')->setDefaultDriver('sync');
        }
        $runner->run(
            $scenario,
            $sync ? fn (float $seconds) => null : null,
            $sync ? fn () => DetectJob::dispatchSync() : null,
        );

        $this->info("Replay of [{$scenario->name}] ".($scenario->fresh()->status).'.');

        return self::SUCCESS;
    }
}
