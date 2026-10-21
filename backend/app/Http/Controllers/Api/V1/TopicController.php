<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Topic;
use Illuminate\Http\JsonResponse;

// TODO Fase 3: topics CRUD and hourly metrics (PRD §11).
// Rule from PRD v2.1 §9.8: a topic created from a template is rejected (422) while any keyword
// still contains "[" or "]"; a new topic becomes active only after passing that validation.
class TopicController extends Controller
{
    public function index(): JsonResponse
    {
        return $this->pendingPhase(3);
    }

    public function store(): JsonResponse
    {
        return $this->pendingPhase(3);
    }

    public function update(Topic $topic): JsonResponse
    {
        return $this->pendingPhase(3);
    }

    public function metrics(Topic $topic): JsonResponse
    {
        return $this->pendingPhase(3);
    }
}
