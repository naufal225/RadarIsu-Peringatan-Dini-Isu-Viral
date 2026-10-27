import { RequirePermission } from "@/components/require-permission";
import { SourcesData } from "./sources-data";

export default function AdminSourcesPage() {
  return (
    <RequirePermission permission="sources.view">
      <SourcesData />
    </RequirePermission>
  );
}
