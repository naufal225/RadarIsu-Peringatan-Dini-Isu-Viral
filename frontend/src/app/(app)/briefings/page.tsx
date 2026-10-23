import { RequirePermission } from "@/components/require-permission";
import { BriefingList } from "./briefing-list";

export default function BriefingsPage() {
  return (
    <RequirePermission permission="briefings.view">
      <BriefingList />
    </RequirePermission>
  );
}
