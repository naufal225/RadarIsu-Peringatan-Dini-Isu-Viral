import { Suspense } from "react";
import { redirect } from "next/navigation";
import { RequirePermission } from "@/components/require-permission";
import { ui } from "@/lib/labels";
import { getMe } from "@/lib/server-api";
import { DashboardPanel } from "./dashboard-panel";

// PRD §11.2, §12.2: situation summary and priority issues for analyst and leader.
export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-ink-muted">{ui.loading}</p>}>
      <DashboardGate />
    </Suspense>
  );
}

async function DashboardGate() {
  const result = await getMe();
  // PRD §12.2: admins have no dashboard.view and are sent to the system status page.
  if (result.status === "ok" && result.me.role.slug === "admin") redirect("/admin/status");

  return (
    <RequirePermission permission="dashboard.view">
      <DashboardPanel />
    </RequirePermission>
  );
}
