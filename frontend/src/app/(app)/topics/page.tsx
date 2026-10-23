import { RequirePermission } from "@/components/require-permission";
import { TopicsPanel } from "./topics-panel";

export default function TopicsPage() {
  return (
    <RequirePermission permission="topics.view">
      <TopicsPanel />
    </RequirePermission>
  );
}
