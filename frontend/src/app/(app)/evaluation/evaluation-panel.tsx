"use client";

import { useState } from "react";
import { Button, ErrorText, PageTitle, Section, StatusBadge, Table, Td } from "@/components/ui";
import { Can } from "@/components/permissions-provider";
import { api, ApiError } from "@/lib/api";
import { f1Change, describeNote, formatPercent, type EvaluationResponse, type EvaluationRun } from "@/lib/evaluation";
import { formatDateTime } from "@/lib/format";
import { describeErrorCode, ui } from "@/lib/labels";
import { useApiData } from "@/lib/use-api-data";

const copy = ui.evaluation;

function latencyText(run: EvaluationRun): string {
  return run.detection_latency_seconds === null ? copy.latencyNone : copy.seconds(run.detection_latency_seconds);
}

export function EvaluationPanel() {
  const { data, error, reload } = useApiData<EvaluationResponse>("evaluation/runs?per_page=50");
  const latest = data?.data[0];

  return (
    <>
      <PageTitle>{copy.title}</PageTitle>
      <p className="mb-4 max-w-3xl text-sm text-neutral-600">{copy.intro}</p>
      <ErrorText>{error ? ui.common.loadError : null}</ErrorText>

      <Can permission="evaluation.run">
        <RunForm scenarios={data?.meta.scenarios ?? []} onDone={reload} />
      </Can>

      {data === null ? (
        <p className="text-sm text-neutral-500">{ui.loading}</p>
      ) : !latest ? (
        <p className="text-sm text-neutral-500">{copy.empty}</p>
      ) : (
        <>
          <Section title={copy.latest}>
            <div className="mb-2 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label={copy.metrics.precision} value={formatPercent(latest.precision)} />
              <Metric label={copy.metrics.recall} value={formatPercent(latest.recall)} />
              <Metric label={copy.metrics.f1} value={formatPercent(latest.f1)} />
              <Metric label={copy.metrics.latency} value={latencyText(latest)} />
            </div>
            <p className="text-sm text-neutral-600">{copy.counts(latest.tp, latest.fp, latest.fn, latest.labeled_posts)}</p>
            {latest.notes.map((note) => (
              <p key={note} className="mt-1 text-xs text-amber-700">
                {describeNote(note)}
              </p>
            ))}
          </Section>

          <Section title={copy.history}>
            <Table
              head={[copy.columns.when, copy.columns.scope, copy.columns.posts, copy.columns.precision, copy.columns.recall, copy.columns.f1, copy.columns.change, copy.columns.latency, copy.columns.by]}
            >
              {data.data.map((run, index) => {
                const change = f1Change(data.data, index);
                return (
                  <tr key={run.id}>
                    <Td>{formatDateTime(run.created_at)}</Td>
                    <Td>{run.scenario ? run.scenario.name : copy.allLabeled}</Td>
                    <Td>{run.labeled_posts}</Td>
                    <Td>{formatPercent(run.precision)}</Td>
                    <Td>{formatPercent(run.recall)}</Td>
                    <Td>{formatPercent(run.f1)}</Td>
                    <Td>{change === null ? copy.changeNone : `${change > 0 ? "+" : ""}${change.toLocaleString("id-ID")} poin`}</Td>
                    <Td>{latencyText(run)}</Td>
                    <Td>{run.run_by ?? ui.common.none}</Td>
                  </tr>
                );
              })}
            </Table>
          </Section>
        </>
      )}

      <Section title={copy.limitsTitle}>
        <StatusBadge tone="muted">{ui.simulatedData}</StatusBadge>
        <ul className="mt-2 max-w-3xl list-disc space-y-1 pl-5 text-sm text-neutral-700">
          {copy.limits.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function RunForm({ scenarios, onDone }: { scenarios: { id: number; name: string }[]; onDone: () => void }) {
  const [scenarioId, setScenarioId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await api("evaluation/run", { method: "POST", body: JSON.stringify({ scenario_id: scenarioId === "" ? null : Number(scenarioId) }) });
      onDone();
    } catch (e) {
      const codes = e instanceof ApiError && e.status === 422 ? Object.values(e.body?.errors ?? {}).flat() : [];
      setError(codes.length > 0 ? codes.map(describeErrorCode).join("; ") : ui.common.actionError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3 text-sm">
      <label className="block">
        {copy.scenario}
        <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} className="ml-2 rounded-md border border-neutral-300 px-2 py-1">
          <option value="">{copy.allLabeled}</option>
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <Button variant="primary" disabled={busy} onClick={run}>
        {busy ? copy.running : copy.run}
      </Button>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
