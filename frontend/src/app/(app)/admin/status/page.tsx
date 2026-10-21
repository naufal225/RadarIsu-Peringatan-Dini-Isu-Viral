import { RequirePermission } from "@/components/require-permission";
import { StatusPanel } from "./status-panel";

export default function AdminStatusPage() {
  return (
    <RequirePermission permission="system.status">
      <StatusPanel />
    </RequirePermission>
  );
}
