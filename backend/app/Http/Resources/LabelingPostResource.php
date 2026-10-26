<?php

namespace App\Http\Resources;

use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One post in the labeling queue (PRD §11, F14-a).
 *
 * @mixin Post
 */
class LabelingPostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'text' => $this->text,
            'posted_at' => $this->posted_at,
            'sentiment' => $this->sentiment,
            'label_manual' => $this->label_manual,
            'is_simulated' => $this->is_simulated,
            'account' => $this->whenLoaded('account', fn () => $this->account
                ? ['id' => $this->account->id, 'handle' => $this->account->handle, 'display_name' => $this->account->display_name]
                : null),
            'topics' => $this->whenLoaded('topics', fn () => $this->topics->map(fn ($topic) => ['id' => $topic->id, 'name' => $topic->name])->values()),
        ];
    }
}
