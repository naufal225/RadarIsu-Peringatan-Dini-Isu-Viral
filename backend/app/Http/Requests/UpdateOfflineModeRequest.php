<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * PUT /settings/offline-mode (F15). Authorization is the `permission:settings.manage` route middleware.
 */
class UpdateOfflineModeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        // `boolean` alone would accept 0, 1 and "true"; the stored value must be a real boolean.
        return ['enabled' => ['required', 'boolean:strict']];
    }
}
