import type { ReactNode } from "react";
import type { Permission } from "@/lib/permissions";
import { getMe } from "@/lib/server-api";
import { Forbidden } from "./forbidden";

/**
 * Server-side page guard: renders the 403 screen instead of the page when the permission is missing.
 * Data is still protected by Laravel; this only avoids rendering an empty page.
 */
export async function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const result = await getMe();
  if (result.status !== "ok" || !result.me.permissions.includes(permission)) return <Forbidden />;

  return <>{children}</>;
}
