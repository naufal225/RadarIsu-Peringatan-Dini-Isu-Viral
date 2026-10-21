// GENERATED FILE — do not edit by hand.
// Source: backend/config/permissions.php. Regenerate: `cd backend && php artisan permissions:export-ts`.
// The frontend only hides UI with these; Laravel enforces every request.

export const PERMISSIONS = [
  "system.status",
  "users.view",
  "users.manage",
  "sources.view",
  "sources.manage",
  "replay.manage",
  "audit.view",
  "settings.manage",
  "topics.view",
  "topics.manage",
  "dashboard.view",
  "alerts.view",
  "alerts.triage",
  "alerts.decide",
  "briefings.view",
  "briefings.create",
  "briefings.download",
  "labels.manage",
  "evaluation.view",
  "evaluation.run",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = [
  "admin",
  "analyst",
  "leader",
] as const;

export type RoleSlug = (typeof ROLES)[number];

export const ROLE_PERMISSIONS: Record<RoleSlug, readonly Permission[]> = {
  admin: [
    "system.status",
    "users.view",
    "users.manage",
    "sources.view",
    "sources.manage",
    "replay.manage",
    "audit.view",
    "settings.manage",
    "evaluation.view",
    "evaluation.run",
  ],
  analyst: [
    "topics.view",
    "topics.manage",
    "dashboard.view",
    "alerts.view",
    "alerts.triage",
    "briefings.view",
    "briefings.create",
    "briefings.download",
    "labels.manage",
    "evaluation.view",
    "evaluation.run",
  ],
  leader: [
    "topics.view",
    "dashboard.view",
    "alerts.view",
    "alerts.decide",
    "briefings.view",
    "briefings.download",
    "evaluation.view",
  ],
};

export type Me = {
  user: { id: number; name: string; email: string };
  role: { slug: RoleSlug; name: string };
  permissions: Permission[];
};

export function hasPermission(granted: readonly Permission[], permission: Permission): boolean {
  return granted.includes(permission);
}
