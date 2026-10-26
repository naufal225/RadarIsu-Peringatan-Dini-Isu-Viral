<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /evaluation/run (F14-b). The scenario, when given, must exist and have been replayed at least once.
 */
class RunEvaluationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'scenario_id' => ['sometimes', 'nullable', 'integer', 'exists:replay_scenarios,id'],
        ];
    }
}
