import { RequirePermission } from "@/components/require-permission";
import { SettingsPanel } from "./settings-panel";

export default function AdminSettingsPage() {
  return (
    <RequirePermission permission="settings.manage">
      <SettingsPanel />
    </RequirePermission>
  );
}
