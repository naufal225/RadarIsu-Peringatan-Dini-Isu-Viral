<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Source;
use Illuminate\Http\JsonResponse;

// TODO Fase 2: sources CRUD, connection test and CSV import (PRD §11).
class SourceController extends Controller
{
    public function index(): JsonResponse
    {
        return $this->pendingPhase(2);
    }

    public function store(): JsonResponse
    {
        return $this->pendingPhase(2);
    }

    public function update(Source $source): JsonResponse
    {
        return $this->pendingPhase(2);
    }

    public function test(Source $source): JsonResponse
    {
        return $this->pendingPhase(2);
    }

    public function import(Source $source): JsonResponse
    {
        return $this->pendingPhase(2);
    }

    public function imports(Source $source): JsonResponse
    {
        return $this->pendingPhase(2);
    }
}
