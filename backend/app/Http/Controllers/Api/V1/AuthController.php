<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private AuditLogger $audit) {}

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => 'required|email|max:190',
            'password' => 'required|string|max:255',
        ]);

        $user = User::where('email', $credentials['email'])->first();

        // Inactive users get the same response as wrong credentials (PRD §8.4).
        if (! $user || ! Hash::check($credentials['password'], $user->password) || ! $user->is_active) {
            $this->audit->log('auth.login_failed', $user, ['email' => $credentials['email']], $user);

            throw ValidationException::withMessages(['email' => ['These credentials do not match our records.']]);
        }

        $user->forceFill(['last_login_at' => now()])->save();
        $token = $user->createToken('bff', ['*'], now()->addMinutes((int) config('sanctum.expiration')));
        $this->audit->log('auth.login', $user, [], $user);

        return response()->json(['data' => [
            'token' => $token->plainTextToken,
            'user' => $this->userPayload($user),
        ]]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->audit->log('auth.logout', $user, [], $user);
        $user->currentAccessToken()->delete();

        return response()->json(['data' => null]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('role');

        return response()->json(['data' => [
            'user' => $this->userPayload($user),
            'role' => ['slug' => $user->role->slug, 'name' => $user->role->name],
            'permissions' => $user->permissionSlugs(),
        ]]);
    }

    /**
     * @return array{id: int, name: string, email: string}
     */
    private function userPayload(User $user): array
    {
        return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email];
    }
}
