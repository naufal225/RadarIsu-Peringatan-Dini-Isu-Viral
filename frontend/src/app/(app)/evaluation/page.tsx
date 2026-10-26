import { RequirePermission } from "@/components/require-permission";
import { EvaluationPanel } from "./evaluation-panel";

export default function EvaluationPage() {
  return (
    <RequirePermission permission="evaluation.view">
      <EvaluationPanel />
    </RequirePermission>
  );
}
