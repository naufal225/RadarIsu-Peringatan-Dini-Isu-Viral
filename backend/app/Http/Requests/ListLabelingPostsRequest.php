<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * GET /labeling/posts filters (F14-a). `status` narrows the queue; `label` implies labeled posts of that label.
 */
class ListLabelingPostsRequest extends FormRequest
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
            'status' => ['sometimes', 'string', Rule::in(['all', 'unlabeled', 'labeled'])],
            'label' => ['sometimes', 'string', Rule::in(LabelPostRequest::LABELS)],
            'is_simulated' => ['sometimes', 'boolean'],
            'topic_id' => ['sometimes', 'integer', 'exists:topics,id'],
            'per_page' => ['sometimes', 'integer', 'between:1,100'],
        ];
    }
}
