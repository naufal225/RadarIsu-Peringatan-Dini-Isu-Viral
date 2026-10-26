<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StartReplayRequest;
use App\Http\Requests\StoreReplayScenarioRequest;
use App\Http\Resources\ReplayScenarioResource;
use App\Jobs\ReplayScenarioJob;
use App\Models\ReplayScenario;
use App\Services\Audit\AuditLogger;
use App\Services\Detection\DataClock;
use App\Services\Ingest\ReplayRunner;
use App\Services\Ingest\ReplayScenarioImporter;
use App\Services\Ingest\ReplayStateException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Replay scenarios (PRD §10.10, §11). Starting hands the run to ReplayScenarioJob; the request returns at once.
 */
class ReplayController extends Controller
{
    public function __construct(private AuditLogger $audit) {}

    public function replayScenarios(Request $request): JsonResponse
    {
        $data = $request->validate(['per_page' => 'sometimes|integer|between:1,100']);

        $page = ReplayScenario::query()->latest('id')->paginate($data['per_page'] ?? 25);

        return response()->json([
            'data' => ReplayScenarioResource::collection($page->getCollection())->resolve($request),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                // What the detectors see as "now" while a replay runs; null means the wall clock.
                'clock_now' => ReplayRunner::clockNow(),
                'data_now' => DataClock::now()->toIso8601String(),
            ],
        ]);
    }

    public function storeReplayScenario(StoreReplayScenarioRequest $request, ReplayScenarioImporter $importer): JsonResponse
    {
        $scenario = $importer->import(
            $request->file('file')->getRealPath(),
            $request->safe()->only(['name', 'description', 'incident_start_offset_seconds', 'default_speed_factor']),
            $request->user(),
        );

        return (new ReplayScenarioResource($scenario))->response()->setStatusCode(201);
    }

    public function startReplay(StartReplayRequest $request, ReplayScenario $scenario, ReplayRunner $runner): JsonResponse
    {
        $speed = (int) ($request->validated('speed_factor') ?? $scenario->default_speed_factor);

        try {
            $scenario = $runner->begin($scenario, $speed);
        } catch (ReplayStateException $e) {
            return response()->json(['message' => $e->getMessage(), 'errors' => ['scenario' => [$e->getMessage()]]], 409);
        }

        $this->audit->log('replay.start', $scenario, ['speed_factor' => $speed, 'run_number' => $scenario->run_number]);
        ReplayScenarioJob::dispatch($scenario->id);

        return (new ReplayScenarioResource($scenario->refresh()))->response()->setStatusCode(202);
    }

    public function stopReplay(ReplayScenario $scenario): JsonResponse
    {
        // Only a running scenario can be stopped; the runner sees the status flip and resets the clock itself.
        $stopped = ReplayScenario::whereKey($scenario->id)->where('status', 'running')->update(['status' => 'stopped', 'finished_at' => now()]);
        if ($stopped === 0) {
            return response()->json(['message' => 'not_running', 'errors' => ['scenario' => ['not_running']]], 409);
        }

        $this->audit->log('replay.stop', $scenario, ['progress_rows' => $scenario->fresh()->progress_rows]);

        return (new ReplayScenarioResource($scenario->refresh()))->response();
    }
}
