<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AlertResource;
use App\Models\Alert;
use App\Services\Alerts\AlertStateMachine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Alert workflow endpoints (PRD §8.5, §11).
 */
class AlertActionController extends Controller
{
    public function __construct(private AlertStateMachine $machine) {}

    public function take(Request $request, Alert $alert): AlertResource
    {
        return $this->transition($request, $alert, 'take');
    }

    public function escalate(Request $request, Alert $alert): AlertResource
    {
        return $this->transition($request, $alert, 'escalate');
    }

    public function falsePositive(Request $request, Alert $alert): AlertResource
    {
        return $this->transition($request, $alert, 'false_positive');
    }

    public function close(Request $request, Alert $alert): AlertResource
    {
        return $this->transition($request, $alert, 'close');
    }

    public function approve(Request $request, Alert $alert): AlertResource
    {
        return $this->transition($request, $alert, 'approve');
    }

    public function returnToAnalyst(Request $request, Alert $alert): AlertResource
    {
        return $this->transition($request, $alert, 'return');
    }

    public function comment(Request $request, Alert $alert): JsonResponse
    {
        return $this->transition($request, $alert, 'comment')->response()->setStatusCode(201);
    }

    /**
     * Permission middleware (403) has already run; then visibility (404), then the state machine (422).
     */
    private function transition(Request $request, Alert $alert, string $action): AlertResource
    {
        Gate::authorize('view', $alert);

        $alert = $this->machine->apply($alert, $action, $request->user(), $request->only('recommendation', 'note'));

        return new AlertResource($alert);
    }
}
