import { RequirePermission } from "@/components/require-permission";
import { AuditData } from "./audit-data";

export default function AdminAuditPage() {
  return (
    <RequirePermission permission="audit.view">
      <AuditData />
    </RequirePermission>
  );
}
