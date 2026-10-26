<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * PUT /labeling/posts/{post} (F14-a, PRD §11). The key must be present: `null` removes the label.
 */
class LabelPostRequest extends FormRequest
{
    public const LABELS = ['organic', 'anomalous'];

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
            'label_manual' => ['present', 'nullable', 'string', Rule::in(self::LABELS)],
        ];
    }
}
