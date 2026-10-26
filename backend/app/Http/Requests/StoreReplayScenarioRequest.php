<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /replay/scenarios (F11): multipart upload of a scenario CSV. The route middleware carries `replay.manage`.
 */
class StoreReplayScenarioRequest extends FormRequest
{
    public const MAX_FILE_KB = 10_240;

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
            'file' => ['required', 'file', 'max:'.self::MAX_FILE_KB],
            'name' => ['required', 'string', 'max:150'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'incident_start_offset_seconds' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:2592000'],
            'default_speed_factor' => ['sometimes', 'nullable', 'integer', 'between:1,100000'],
        ];
    }
}
