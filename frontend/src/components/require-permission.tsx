import { Suspense, type ReactNode } from "react";
import type { Permission } from "@/lib/permissions";
import { getMe } from "@/lib/server-api";
import { BackendUnavailable } from "./backend-unavailable";
import { Forbidden } from "./forbidden";
import { SkeletonCard } from "./radar/skeleton";

/**
 * Server-side page guard: renders the 403 screen instead of the page when the permission is missing.
 * Data is still protected by Laravel; this only avoids rendering an empty page.
 *
 * The check fetches GET /auth/me, so it sits inside <Suspense>: with cacheComponents a fetch outside a
 * boundary blocks prerendering and instant navigation ("uncached data during prerendering").
 */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  return (
    <Suspense fallback={<SkeletonCard />}>
      <PermissionGate permission={permission}>{children}</PermissionGate>
    </Suspense>
  );
}

async function PermissionGate({ permission, children }: { permission: Permission; children: ReactNode }) {
  const result = await getMe();
  if (result.status === "unavailable") return <BackendUnavailable />;
  if (result.status !== "ok" || !result.me.permissions.includes(permission)) return <Forbidden />;

  return <>{children}</>;
}
