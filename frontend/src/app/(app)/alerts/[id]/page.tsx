import { RequirePermission } from "@/components/require-permission";
import { AlertDetail } from "./alert-detail";

export default async function AlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="alerts.view">
      <AlertDetail id={Number(id)} />
    </RequirePermission>
  );
}
