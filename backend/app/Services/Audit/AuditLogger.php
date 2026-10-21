<?php

namespace App\Services\Audit;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Minimal audit writer (PRD §9.6, §9.7). Phase 2 extends this; Phase 1 needs it for
 * auth.* and alert.* actions (PRD §19.2 item 7).
 */
class AuditLogger
{
    public function __construct(private Request $request) {}

    /**
     * @param  string  $action  One of the PRD §9.7 action values.
     * @param  array<string, mixed>  $detail
     */
    public function log(string $action, ?Model $object = null, array $detail = [], ?User $user = null): AuditLog
    {
        return AuditLog::create([
            'user_id' => ($user ?? $this->request->user())?->getKey(),
            'action' => $action,
            'object_type' => $object ? Str::snake(class_basename($object)) : null,
            'object_id' => $object?->getKey(),
            'detail' => $detail,
            'ip_address' => $this->request->ip() ?? '0.0.0.0',
            'user_agent' => Str::limit((string) $this->request->userAgent(), 252, '...') ?: null,
        ]);
    }
}
