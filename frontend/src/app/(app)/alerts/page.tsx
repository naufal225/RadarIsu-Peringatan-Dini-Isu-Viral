import { RequirePermission } from "@/components/require-permission";
import { AlertList } from "./alert-list";

export default function AlertsPage() {
  return (
    <RequirePermission permission="alerts.view">
      <AlertList />
    </RequirePermission>
  );
}
