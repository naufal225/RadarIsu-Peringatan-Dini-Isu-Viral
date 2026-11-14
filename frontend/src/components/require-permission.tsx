import { Suspense, type ReactNode } from "react";
import type { Permission } from "@/lib/permissions";
import { ui } from "@/lib/labels";
import { getMe } from "@/lib/server-api";
import { BackendUnavailable } from "./backend-unavailable";
import { Forbidden } from "./forbidden";

/**
 * Server-side page guard: renders the 403 screen instead of the page when the permission is missing.
 * Data is still protected by Laravel; this only avoids rendering an empty page.
 *
 * The check reads the request cookie, so it runs inside its own Suspense boundary. Without it, a client
 * navigation waits on uncached request data ("Next.js encountered uncached data during a navigation").
 */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-ink-muted">{ui.loading}</p>}>
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
