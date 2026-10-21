<?php

namespace App\Services\Alerts;

use App\Models\Alert;
use App\Models\AlertAction;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * Alert workflow (PRD §8.5). Wrong role → 403, invalid source status → 422.
 * Every applied action writes exactly one alert_actions row and one audit_logs row.
 */
class AlertStateMachine
{
    /**
     * action => [from statuses (null = any except `new`), to status (null = unchanged), roles, field rules]
     *
     * @var array<string, array{from: list<string>|null, to: string|null, roles: list<string>, rules: array<string, string>}>
     */
    public const TRANSITIONS = [
        'take' => [
            'from' => ['new'], 'to' => 'reviewing', 'roles' => ['analyst'],
            'rules' => [],
        ],
        'escalate' => [
            'from' => ['reviewing', 'returned'], 'to' => 'escalated', 'roles' => ['analyst'],
            'rules' => ['recommendation' => 'required|string|max:5000', 'note' => 'nullable|string|max:5000'],
        ],
        'false_positive' => [
            'from' => ['reviewing', 'returned'], 'to' => 'false_positive', 'roles' => ['analyst'],
            'rules' => ['note' => 'required|string|max:5000'],
        ],
        'close' => [
            'from' => ['reviewing', 'returned'], 'to' => 'closed', 'roles' => ['analyst'],
            'rules' => ['note' => 'required|string|max:5000'],
        ],
        'approve' => [
            'from' => ['escalated'], 'to' => 'approved', 'roles' => ['leader'],
            'rules' => ['note' => 'nullable|string|max:5000'],
        ],
        'return' => [
            'from' => ['escalated'], 'to' => 'returned', 'roles' => ['leader'],
            'rules' => ['note' => 'required|string|max:5000'],
        ],
        'comment' => [
            'from' => null, 'to' => null, 'roles' => ['analyst', 'leader'],
            'rules' => ['note' => 'required|string|max:5000'],
        ],
    ];

    public function __construct(private AuditLogger $audit) {}

    /**
     * @param  array<string, mixed>  $input
     *
     * @throws AuthorizationException
     * @throws ValidationException
     */
    public function apply(Alert $alert, string $action, User $user, array $input = []): Alert
    {
        $transition = self::TRANSITIONS[$action] ?? throw new InvalidArgumentException("Unknown alert action [$action].");

        if (! in_array($user->role->slug, $transition['roles'], true)) {
            throw new AuthorizationException;
        }

        $data = Validator::make($input, $transition['rules'])->validate();

        return DB::transaction(function () use ($alert, $action, $user, $transition, $data) {
            $alert = Alert::whereKey($alert->getKey())->lockForUpdate()->firstOrFail();
            $from = $alert->status;

            if (! $this->allowedFrom($transition['from'], $from)) {
                throw ValidationException::withMessages([
                    'status' => ["Action [$action] is not allowed from status [$from]."],
                ]);
            }

            if ($transition['to'] !== null) {
                $alert->fill(['status' => $transition['to']] + $this->sideEffects($action, $user, $data));
                $alert->save();
            }

            AlertAction::create([
                'alert_id' => $alert->id,
                'user_id' => $user->id,
                'action' => $action,
                'from_status' => $from,
                'to_status' => $transition['to'],
                'note' => $data['note'] ?? null,
            ]);

            $this->audit->log("alert.$action", $alert, array_filter([
                'from_status' => $from,
                'to_status' => $transition['to'],
            ]), $user);

            return $alert;
        });
    }

    /**
     * @param  list<string>|null  $from
     */
    private function allowedFrom(?array $from, string $status): bool
    {
        return $from === null ? $status !== 'new' : in_array($status, $from, true);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function sideEffects(string $action, User $user, array $data): array
    {
        return match ($action) {
            'take' => ['assigned_to' => $user->id],
            'escalate' => ['recommendation' => $data['recommendation'], 'escalated_at' => now()],
            'approve', 'return' => ['decided_at' => now()],
            'false_positive', 'close' => ['closed_at' => now()],
            default => [],
        };
    }
}
