"use client";

import { useState } from "react";
import { EvaluationView } from "@/components/evaluation/evaluation-view";
import { useCan } from "@/components/permissions-provider";
import { api, ApiError } from "@/lib/api";
import type { EvaluationResponse } from "@/lib/evaluation";
import { describeErrorCode, ui } from "@/lib/labels";
import { useApiData } from "@/lib/use-api-data";

export function EvaluationPanel() {
  const can = useCan();
  const { data, error, reload } = useApiData<EvaluationResponse>("evaluation/runs?per_page=50");
  const [scenarioId, setScenarioId] = useState("");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setRunError(null);
    try {
      await api("evaluation/run", {
        method: "POST",
        body: JSON.stringify({ scenario_id: scenarioId === "" ? null : Number(scenarioId) }),
      });
      reload();
    } catch (e) {
      const codes = e instanceof ApiError && e.status === 422 ? Object.values(e.body?.errors ?? {}).flat() : [];
      setRunError(codes.length > 0 ? codes.map(describeErrorCode).join("; ") : ui.common.actionError);
    } finally {
      setRunning(false);
    }
  }

  return (
    <EvaluationView
      data={error ? null : (data ?? null)}
      failed={Boolean(error)}
      onRetry={reload}
      canRun={can("evaluation.run")}
      running={running}
      runError={runError}
      scenarioId={scenarioId}
      onScenarioChange={setScenarioId}
      onRun={run}
    />
  );
}
