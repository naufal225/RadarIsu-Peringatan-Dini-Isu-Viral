<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /replay/scenarios/{id}/start (F11). `speed_factor` is virtual seconds per real second.
 */
class StartReplayRequest extends FormRequest
{
    public const MAX_SPEED = 100_000;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'speed_factor' => ['sometimes', 'nullable', 'integer', 'between:1,'.self::MAX_SPEED],
        ];
    }
}
