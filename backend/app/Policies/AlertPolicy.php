<?php

namespace App\Policies;

use App\Models\Alert;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Object-level alert rules (PRD v2.1 §8.4).
 *
 * Check order for every alert endpoint: permission middleware (403) → view (404 when the alert
 * is not visible, so its existence does not leak) → AlertStateMachine (422).
 */
class AlertPolicy
{
    public function view(User $user, Alert $alert): Response
    {
        $visible = $user->hasPermission('alerts.view') && match ($user->role->slug) {
            'analyst' => true,
            'leader' => in_array($alert->status, Alert::LEADER_VISIBLE_STATUSES, true),
            default => false,
        };

        return $visible ? Response::allow() : Response::denyAsNotFound();
    }

    public function createBriefing(User $user, Alert $alert): Response
    {
        if (! $user->hasPermission('briefings.create')) {
            return Response::deny();
        }

        return $this->view($user, $alert);
    }
}
