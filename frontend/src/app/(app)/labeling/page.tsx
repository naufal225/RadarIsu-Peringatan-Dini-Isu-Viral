import { RequirePermission } from "@/components/require-permission";
import { LabelingPanel } from "./labeling-panel";

export default function LabelingPage() {
  return (
    <RequirePermission permission="labels.manage">
      <LabelingPanel />
    </RequirePermission>
  );
}
