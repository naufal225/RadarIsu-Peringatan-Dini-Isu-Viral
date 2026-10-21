import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AppNav } from "@/components/app-nav";
import { LogoutButton } from "@/components/logout-button";
import { PermissionsProvider } from "@/components/permissions-provider";
import { roleLabels, ui } from "@/lib/labels";
import { getMe } from "@/lib/server-api";

// Role-aware shell (PRD §12.1): loads GET /auth/me on the server and hands permissions to the client provider.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-neutral-500">{ui.loading}</p>}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}

async function AuthenticatedShell({ children }: { children: ReactNode }) {
  const result = await getMe();
  if (result.status !== "ok") redirect("/login");

  const { me } = result;

  return (
    <PermissionsProvider me={me}>
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3">
        <span className="font-semibold">{ui.appName}</span>
        <div className="flex items-center gap-4 text-sm">
          <span>
            {me.user.name} · {roleLabels[me.role.slug]}
          </span>
          <LogoutButton />
        </div>
      </header>
      <AppNav />
      <main className="flex-1 px-6 py-6">{children}</main>
    </PermissionsProvider>
  );
}
