<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * GET /topics/{topic}/spike-baseline (F3). Authorization is the `permission:topics.view` route middleware.
 */
class SpikeBaselineRequest extends FormRequest
{
    public const DEFAULT_HOURS = 72;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return ['hours' => ['sometimes', 'integer', 'between:6,168']];
    }

    public function hours(): int
    {
        return (int) ($this->validated('hours') ?? self::DEFAULT_HOURS);
    }
}
