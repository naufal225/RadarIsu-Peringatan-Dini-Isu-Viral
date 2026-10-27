import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { PermissionsProvider } from "@/components/permissions-provider";
import { AppShell } from "@/components/shell/app-shell";
import { ui } from "@/lib/labels";
import { getMe } from "@/lib/server-api";

// Shell berperan (PRD §12.1, Design System §7): memuat GET /auth/me di server dan meneruskan izin ke provider klien.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-ink-muted">{ui.loading}</p>}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}

async function AuthenticatedShell({ children }: { children: ReactNode }) {
  const result = await getMe();
  if (result.status !== "ok") redirect("/login");

  return (
    <PermissionsProvider me={result.me}>
      <AppShell>{children}</AppShell>
    </PermissionsProvider>
  );
}
