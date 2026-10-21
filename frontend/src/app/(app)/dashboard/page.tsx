import { redirect } from "next/navigation";
import { RequirePermission } from "@/components/require-permission";
import { ui } from "@/lib/labels";
import { getMe } from "@/lib/server-api";

// TODO Fase 6/8: situation summary from GET /dashboard/summary.
export default async function DashboardPage() {
  const result = await getMe();
  // PRD §12.2: admins have no dashboard.view and are sent to the system status page.
  if (result.status === "ok" && result.me.role.slug === "admin") redirect("/admin/status");

  return (
    <RequirePermission permission="dashboard.view">
      <h1 className="text-xl font-semibold">{ui.dashboard.title}</h1>
      <p className="mt-2 text-sm text-neutral-600">{ui.dashboard.pending}</p>
    </RequirePermission>
  );
}
