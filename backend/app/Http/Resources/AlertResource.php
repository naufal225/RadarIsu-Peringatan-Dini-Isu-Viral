<?php

namespace App\Http\Resources;

use App\Models\Alert;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Alert shape per PRD §11.3.
 *
 * @mixin Alert
 */
class AlertResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind,
            'status' => $this->status,
            'score' => $this->score,
            'severity' => $this->severity,
            'topic' => $this->whenLoaded('topic', fn () => $this->topic
                ? ['id' => $this->topic->id, 'name' => $this->topic->name]
                : null),
            'subject_account' => $this->whenLoaded('subjectAccount', fn () => $this->subjectAccount
                ? ['id' => $this->subjectAccount->id, 'handle' => $this->subjectAccount->handle]
                : null),
            'score_breakdown' => $this->score_breakdown,
            'detected_at' => $this->detected_at,
            'window_start' => $this->window_start,
            'window_end' => $this->window_end,
            'assigned_to' => $this->assigned_to,
            'recommendation' => $this->recommendation,
            'escalated_at' => $this->escalated_at,
            'decided_at' => $this->decided_at,
            'closed_at' => $this->closed_at,
            'evidence' => $this->whenLoaded('evidence', fn () => $this->evidence->map(fn ($evidence) => [
                'id' => $evidence->id,
                'reason' => $evidence->reason,
                'account' => $evidence->account ? ['id' => $evidence->account->id, 'handle' => $evidence->account->handle] : null,
                'post' => $evidence->post ? ['id' => $evidence->post->id, 'text' => $evidence->post->text, 'is_simulated' => $evidence->post->is_simulated] : null,
                'detail' => $evidence->detail,
            ])),
            'actions' => $this->whenLoaded('actions', fn () => $this->actions->map(fn ($action) => [
                'action' => $action->action,
                'from_status' => $action->from_status,
                'to_status' => $action->to_status,
                'user' => $action->user?->name,
                'note' => $action->note,
                'created_at' => $action->created_at,
            ])),
        ];
    }
}
