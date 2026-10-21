<?php

namespace App\Services\Audit;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * The only writer of audit_logs (PRD §9.6, §9.7, §13). The table is append-only at the
 * database level as well (trigger), so entries cannot be altered after the fact.
 */
class AuditLogger
{
    /** PRD §9.7, in document order. */
    public const ACTIONS = [
        'auth.login', 'auth.login_failed', 'auth.logout', 'user.create', 'user.update', 'user.deactivate',
        'source.create', 'source.update', 'source.test', 'source.import', 'topic.create', 'topic.update',
        'official_account.create', 'official_account.delete', 'alert.take', 'alert.escalate',
        'alert.false_positive', 'alert.close', 'alert.approve', 'alert.return', 'alert.comment',
        'briefing.create', 'briefing.download', 'replay.start', 'replay.stop', 'settings.update',
        'label.set', 'evaluation.run',
    ];

    public function __construct(private Request $request) {}

    /**
     * @param  string  $action  One of self::ACTIONS.
     * @param  array<string, mixed>  $detail  Never put secrets (passwords, tokens) here.
     */
    public function log(string $action, ?Model $object = null, array $detail = [], ?User $user = null): AuditLog
    {
        if (! in_array($action, self::ACTIONS, true)) {
            throw new InvalidArgumentException("Unknown audit action [$action]; see PRD §9.7.");
        }

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
