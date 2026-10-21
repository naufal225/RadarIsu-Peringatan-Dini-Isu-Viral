import { RequirePermission } from "@/components/require-permission";
import { AuditPanel } from "./audit-panel";

export default function AdminAuditPage() {
  return (
    <RequirePermission permission="audit.view">
      <AuditPanel />
    </RequirePermission>
  );
}
