<?php

namespace App\Http\Resources;

use App\Models\OfficialAccount;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin OfficialAccount
 */
class OfficialAccountResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'handle' => $this->handle,
            'display_name' => $this->display_name,
            'note' => $this->note,
            'created_at' => $this->created_at,
        ];
    }
}
