import { Suspense } from "react";
import { RequirePermission } from "@/components/require-permission";
import { ui } from "@/lib/labels";
import { AlertDetail } from "./alert-detail";

export default function AlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-ink-muted">{ui.loading}</p>}>
      <AlertDetailContent params={params} />
    </Suspense>
  );
}

async function AlertDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="alerts.view">
      <AlertDetail id={Number(id)} />
    </RequirePermission>
  );
}
