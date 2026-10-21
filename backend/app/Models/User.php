<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password', 'role_id', 'is_active', 'last_login_at'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /** Seconds the permission list is cached (PRD §13). */
    public const PERMISSION_CACHE_TTL = 60;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::updated(function (User $user) {
            if ($user->wasChanged('role_id')) {
                $user->forgetPermissionCache();
            }

            if ($user->wasChanged('is_active') && ! $user->is_active) {
                $user->tokens()->delete();
            }
        });
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    /**
     * Permission slugs granted through the user's role, in permission seed order.
     *
     * @return list<string>
     */
    public function permissionSlugs(): array
    {
        return Cache::remember(
            $this->permissionCacheKey(),
            self::PERMISSION_CACHE_TTL,
            fn () => Permission::query()
                ->join('permission_role', 'permission_role.permission_id', '=', 'permissions.id')
                ->where('permission_role.role_id', $this->role_id)
                ->orderBy('permissions.id')
                ->pluck('permissions.slug')
                ->all(),
        );
    }

    public function hasPermission(string $slug): bool
    {
        return in_array($slug, $this->permissionSlugs(), true);
    }

    public function hasRole(string $slug): bool
    {
        return $this->role?->slug === $slug;
    }

    public function forgetPermissionCache(): void
    {
        Cache::forget($this->permissionCacheKey());
    }

    private function permissionCacheKey(): string
    {
        return "user:{$this->id}:permissions";
    }
}
