import { RequirePermission } from "@/components/require-permission";
import { ui } from "@/lib/labels";

// TODO Fase 8: system health from GET /system/status.
export default function AdminStatusPage() {
  return (
    <RequirePermission permission="system.status">
      <h1 className="text-xl font-semibold">{ui.adminStatus.title}</h1>
      <p className="mt-2 text-sm text-neutral-600">{ui.adminStatus.pending}</p>
    </RequirePermission>
  );
}
