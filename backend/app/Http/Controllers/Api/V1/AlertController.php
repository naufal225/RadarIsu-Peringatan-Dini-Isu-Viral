<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AlertResource;
use App\Models\Alert;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class AlertController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(Alert::STATUSES)],
            'severity' => ['nullable', Rule::in(Alert::SEVERITIES)],
            'kind' => ['nullable', Rule::in(Alert::KINDS)],
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $alerts = Alert::query()
            ->visibleTo($request->user())
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['severity'] ?? null, fn ($q, $severity) => $q->where('severity', $severity))
            ->when($filters['kind'] ?? null, fn ($q, $kind) => $q->where('kind', $kind))
            ->with(['topic', 'subjectAccount'])
            ->orderByDesc('score')
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 50);

        return AlertResource::collection($alerts);
    }

    public function show(Alert $alert): AlertResource
    {
        Gate::authorize('view', $alert);

        return new AlertResource($alert->load([
            'topic', 'subjectAccount', 'evidence.account', 'evidence.post', 'actions.user',
        ]));
    }
}
