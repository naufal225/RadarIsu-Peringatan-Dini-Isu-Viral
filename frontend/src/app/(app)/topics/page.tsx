import { Can } from "@/components/permissions-provider";
import { RequirePermission } from "@/components/require-permission";
import { LookalikesPanel } from "./lookalikes-panel";
import { TopicsPanel } from "./topics-panel";

export default function TopicsPage() {
  return (
    <RequirePermission permission="topics.view">
      <TopicsPanel />
      {/* Names accounts as suspected impersonators: the API allows analysts only, this just hides the section. */}
      <Can permission="alerts.triage">
        <LookalikesPanel />
      </Can>
    </RequirePermission>
  );
}
