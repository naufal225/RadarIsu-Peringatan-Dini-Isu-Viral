import { RequirePermission } from "@/components/require-permission";
import { LabelingData } from "./labeling-data";

export default function LabelingPage() {
  return (
    <RequirePermission permission="labels.manage">
      <LabelingData />
    </RequirePermission>
  );
}
