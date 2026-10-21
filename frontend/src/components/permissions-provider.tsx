"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { hasPermission, type Me, type Permission } from "@/lib/permissions";

// Hides UI the user cannot use (PRD §12.1). Never a security boundary: Laravel enforces every request.

const MeContext = createContext<Me | null>(null);

export function PermissionsProvider({ me, children }: { me: Me; children: ReactNode }) {
  return <MeContext.Provider value={me}>{children}</MeContext.Provider>;
}

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe must be used inside <PermissionsProvider>");
  return me;
}

export function useCan(): (permission: Permission) => boolean {
  const me = useMe();
  return useCallback((permission: Permission) => hasPermission(me.permissions, permission), [me]);
}

export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const can = useCan();
  return <>{can(permission) ? children : fallback}</>;
}
