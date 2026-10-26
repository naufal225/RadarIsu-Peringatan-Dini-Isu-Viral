<?php

namespace App\Console\Commands;

use App\Models\ReplayScenario;
use App\Models\User;
use App\Services\Evaluation\EvaluationService;
use Illuminate\Console\Command;

/**
 * `radarisu:evaluate` (PRD §10.2): account-level precision, recall, F1 and detection latency.
 */
class EvaluateCommand extends Command
{
    protected $signature = 'radarisu:evaluate {--scenario= : Replay scenario id; omit to evaluate every labeled post} {--user= : User id recorded as the runner (default: first admin)}';

    protected $description = 'Evaluate detection against manual labels and store an evaluation run';

    public function handle(EvaluationService $service): int
    {
        $scenario = null;
        if ($this->option('scenario') !== null) {
            $scenario = ReplayScenario::find($this->option('scenario'));
            if ($scenario === null || $scenario->source_id === null) {
                $this->error('Scenario not found or never replayed.');

                return self::FAILURE;
            }
        }
        $user = $this->option('user') !== null
            ? User::find($this->option('user'))
            : User::whereHas('role', fn ($q) => $q->where('slug', 'admin'))->orderBy('id')->first();
        if ($user === null) {
            $this->error('User not found.');

            return self::FAILURE;
        }

        $run = $service->run($user, $scenario);
        $this->table(['labeled_posts', 'tp', 'fp', 'fn', 'precision', 'recall', 'f1', 'latency_s', 'notes'], [[
            $run->labeled_posts, $run->tp, $run->fp, $run->fn, $run->precision, $run->recall, $run->f1,
            $run->detection_latency_seconds ?? '-', $run->notes ?? '-',
        ]]);

        return self::SUCCESS;
    }
}
