<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\RunEvaluationRequest;
use App\Http\Resources\EvaluationRunResource;
use App\Models\EvaluationRun;
use App\Models\ReplayScenario;
use App\Services\Audit\AuditLogger;
use App\Services\Evaluation\EvaluationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Evaluation runs (PRD §11, §15; F14-b). Reading is open to all three roles but returns aggregates only.
 */
class EvaluationController extends Controller
{
    public function __construct(private AuditLogger $audit) {}

    public function runs(Request $request): JsonResponse
    {
        $data = $request->validate(['per_page' => 'sometimes|integer|between:1,100']);

        $page = EvaluationRun::query()->with(['scenario:id,name', 'runner:id,name'])->latest('id')->paginate($data['per_page'] ?? 25);

        return response()->json([
            'data' => EvaluationRunResource::collection($page->getCollection())->resolve($request),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                // Scenarios that were replayed at least once, for the "run" form (analysts cannot list /replay/scenarios).
                'scenarios' => ReplayScenario::query()->whereNotNull('source_id')->orderBy('name')->get(['id', 'name']),
            ],
        ]);
    }

    public function run(RunEvaluationRequest $request, EvaluationService $service): JsonResponse
    {
        $scenario = null;
        if ($request->validated('scenario_id') !== null) {
            $scenario = ReplayScenario::findOrFail($request->validated('scenario_id'));
            if ($scenario->source_id === null) {
                return response()->json(['message' => 'scenario_not_replayed', 'errors' => ['scenario_id' => ['scenario_not_replayed']]], 422);
            }
        }

        $run = $service->run($request->user(), $scenario);
        $this->audit->log('evaluation.run', $run, ['scenario_id' => $scenario?->id, 'f1' => (float) $run->f1]);

        return (new EvaluationRunResource($run->load(['scenario:id,name', 'runner:id,name'])))->response()->setStatusCode(201);
    }
}
