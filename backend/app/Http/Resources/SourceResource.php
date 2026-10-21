<?php

namespace App\Http\Resources;

use App\Models\Source;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Source
 */
class SourceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'name' => $this->name,
            'config' => (object) $this->config,
            'interval_minutes' => $this->interval_minutes,
            'is_active' => $this->is_active,
            'is_simulated' => $this->is_simulated,
            'last_fetched_at' => $this->last_fetched_at,
            'last_status' => $this->last_status,
            'last_error' => $this->last_error,
            'created_at' => $this->created_at,
            'raw_items_count' => $this->whenCounted('rawItems'),
        ];
    }
}
