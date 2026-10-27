import { RequirePermission } from "@/components/require-permission";
import { SettingsData } from "./settings-data";

export default function AdminSettingsPage() {
  return (
    <RequirePermission permission="settings.manage">
      <SettingsData />
    </RequirePermission>
  );
}
