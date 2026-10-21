<?php

namespace App\Policies;

use App\Models\Briefing;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * PRD §8.4: a briefing is downloadable only when its alert is visible to the user (404 otherwise).
 */
class BriefingPolicy
{
    public function __construct(private AlertPolicy $alerts) {}

    public function download(User $user, Briefing $briefing): Response
    {
        if (! $user->hasPermission('briefings.download')) {
            return Response::deny();
        }

        return $this->alerts->view($user, $briefing->alert);
    }
}
