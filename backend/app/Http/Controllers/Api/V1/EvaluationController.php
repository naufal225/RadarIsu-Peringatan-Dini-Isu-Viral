<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Post;
use Illuminate\Http\JsonResponse;

// TODO Fase 7: labeling queue and evaluation runs (PRD §15).
class EvaluationController extends Controller
{
    public function labelingPosts(): JsonResponse
    {
        return $this->pendingPhase(7);
    }

    public function labelPost(Post $post): JsonResponse
    {
        return $this->pendingPhase(7);
    }

    public function runs(): JsonResponse
    {
        return $this->pendingPhase(7);
    }

    public function run(): JsonResponse
    {
        return $this->pendingPhase(7);
    }
}
