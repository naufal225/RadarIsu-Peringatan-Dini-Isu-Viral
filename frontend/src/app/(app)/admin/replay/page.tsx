import { RequirePermission } from "@/components/require-permission";
import { ReplayData } from "./replay-data";

export default function AdminReplayPage() {
  return (
    <RequirePermission permission="replay.manage">
      <ReplayData />
    </RequirePermission>
  );
}
