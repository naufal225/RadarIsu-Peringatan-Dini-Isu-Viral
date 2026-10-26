import { RequirePermission } from "@/components/require-permission";
import { ReplayPanel } from "./replay-panel";

export default function AdminReplayPage() {
  return (
    <RequirePermission permission="replay.manage">
      <ReplayPanel />
    </RequirePermission>
  );
}
