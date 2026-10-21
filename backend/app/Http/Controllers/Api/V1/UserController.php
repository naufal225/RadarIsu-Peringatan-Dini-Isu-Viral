<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\Role;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function __construct(private AuditLogger $audit) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $perPage = $request->validate(['per_page' => 'nullable|integer|min:1|max:100'])['per_page'] ?? 50;

        return UserResource::collection(User::with('role')->orderBy('name')->paginate((int) $perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'email' => 'required|email|max:190|unique:users,email',
            'password' => ['required', 'string', 'max:255', Password::min(10)], // PRD §13
            'role' => ['required', Rule::in(array_keys(config('permissions.roles')))],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'role_id' => Role::where('slug', $data['role'])->value('id'),
            'is_active' => true,
        ]);

        $this->audit->log('user.create', $user, ['email' => $user->email, 'role' => $data['role']]);

        return (new UserResource($user->load('role')))->response()->setStatusCode(201);
    }

    /**
     * Name, role and activation, with the self-protection rule (PRD §8.4).
     */
    public function update(Request $request, User $user): UserResource
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

        $this->audit->log($deactivating ? 'user.deactivate' : 'user.update', $user, ['changes' => array_keys($user->getChanges())]);

        return new UserResource($user->load('role'));
    }
}
