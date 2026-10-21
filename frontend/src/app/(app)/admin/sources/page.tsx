import { RequirePermission } from "@/components/require-permission";
import { SourcesPanel } from "./sources-panel";

export default function AdminSourcesPage() {
  return (
    <RequirePermission permission="sources.view">
      <SourcesPanel />
    </RequirePermission>
  );
}
