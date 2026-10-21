<?php

namespace App\Support;

/**
 * Renders frontend/src/lib/permissions.ts from config/permissions.php so the RBAC matrix
 * has a single source of truth (PRD v2.1 §8.3, §12.1).
 */
class PermissionsTypeScript
{
    public static function defaultPath(): string
    {
        return dirname(base_path()).DIRECTORY_SEPARATOR.implode(DIRECTORY_SEPARATOR, ['frontend', 'src', 'lib', 'permissions.ts']);
    }

    public static function render(): string
    {
        $config = config('permissions');

        $permissions = self::stringList(array_keys($config['permissions']), '  ');
        $roles = self::stringList(array_keys($config['roles']), '  ');

        $matrix = collect($config['matrix'])
            ->map(fn (array $slugs, string $role) => "  {$role}: [\n".self::stringList($slugs, '    ')."  ],\n")
            ->implode('');

        return <<<TS
// GENERATED FILE — do not edit by hand.
// Source: backend/config/permissions.php. Regenerate: `cd backend && php artisan permissions:export-ts`.
// The frontend only hides UI with these; Laravel enforces every request.

export const PERMISSIONS = [
{$permissions}] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = [
{$roles}] as const;

export type RoleSlug = (typeof ROLES)[number];

export const ROLE_PERMISSIONS: Record<RoleSlug, readonly Permission[]> = {
{$matrix}};

export type Me = {
  user: { id: number; name: string; email: string };
  role: { slug: RoleSlug; name: string };
  permissions: Permission[];
};

export function hasPermission(granted: readonly Permission[], permission: Permission): boolean {
  return granted.includes(permission);
}

TS;
    }

    /**
     * @param  list<string>  $values
     */
    private static function stringList(array $values, string $indent): string
    {
        return collect($values)->map(fn (string $value) => $indent.json_encode($value).",\n")->implode('');
    }
}
