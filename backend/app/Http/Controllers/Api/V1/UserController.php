<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    // TODO Fase 2: list users.
    public function index(): JsonResponse
    {
        return $this->pendingPhase(2);
    }

    // TODO Fase 2: create user.
    public function store(): JsonResponse
    {
        return $this->pendingPhase(2);
    }

    /**
     * Minimal update for Phase 1: name, role and activation, with the self-protection rule (PRD §8.4).
     */
    public function update(Request $request, User $user, AuditLogger $audit): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:120',
            'role' => ['sometimes', Rule::in(array_keys(config('permissions.roles')))],
            'is_active' => 'sometimes|boolean',
        ]);

        if ($request->user()->is($user)) {
            if (array_key_exists('is_active', $data) && ! $data['is_active']) {
                throw ValidationException::withMessages(['is_active' => ['You cannot deactivate your own account.']]);
            }
            if (array_key_exists('role', $data) && $data['role'] !== $user->role->slug) {
                throw ValidationException::withMessages(['role' => ['You cannot change your own role.']]);
            }
        }

        if (array_key_exists('role', $data)) {
            $data['role_id'] = Role::where('slug', $data['role'])->value('id');
            unset($data['role']);
        }

        $deactivating = array_key_exists('is_active', $data) && ! $data['is_active'] && $user->is_active;
        $user->update($data);

        $audit->log($deactivating ? 'user.deactivate' : 'user.update', $user, ['changes' => array_keys($user->getChanges())]);

        $user->load('role');

        return response()->json(['data' => [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->slug,
            'is_active' => $user->is_active,
        ]]);
    }
}
