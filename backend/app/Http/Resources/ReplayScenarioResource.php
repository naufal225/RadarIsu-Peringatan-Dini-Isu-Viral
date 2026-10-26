<?php

namespace App\Http\Resources;

use App\Models\ReplayScenario;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ReplayScenario
 */
class ReplayScenarioResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'total_rows' => $this->total_rows,
            'incident_start_offset_seconds' => $this->incident_start_offset_seconds,
            'default_speed_factor' => $this->default_speed_factor,
            'status' => $this->status,
            'speed_factor' => $this->speed_factor,
            'run_number' => $this->run_number,
            'progress_rows' => $this->progress_rows,
            'started_at' => $this->started_at,
            'virtual_anchor_at' => $this->virtual_anchor_at,
            'heartbeat_at' => $this->heartbeat_at,
            'finished_at' => $this->finished_at,
            'error' => $this->error,
            'source_id' => $this->source_id,
            'created_at' => $this->created_at,
        ];
    }
}
