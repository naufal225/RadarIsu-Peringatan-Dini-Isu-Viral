"use client";

import { useState } from "react";
import { BarChart2, Play } from "lucide-react";
import { PageHeader } from "@/components/radar/page-header";
import { Section } from "@/components/radar/section";
import { Stat } from "@/components/radar/stat";
import { Button } from "@/components/radar/button";
import { DataTable, type DataTableColumn } from "@/components/radar/data-table";
import { SimBadge } from "@/components/radar/simulation";
import { Waktu } from "@/components/radar/waktu";
import { controlClass, FieldError } from "@/components/radar/form";
import { ErrorState } from "@/components/radar/states";
import { SkeletonRows } from "@/components/radar/skeleton";
import { Can } from "@/components/permissions-provider";
import { api, ApiError } from "@/lib/api";
import { f1Change, describeNote, formatPercent, type EvaluationResponse, type EvaluationRun } from "@/lib/evaluation";
import { describeErrorCode, ui } from "@/lib/labels";
import { useApiData } from "@/lib/use-api-data";

const copy = ui.evaluation;

function latencyText(run: EvaluationRun): string {
  return run.detection_latency_seconds === null ? copy.latencyNone : copy.seconds(run.detection_latency_seconds);
}

export function EvaluationPanel() {
  const { data, error, reload } = useApiData<EvaluationResponse>("evaluation/runs?per_page=50");
  const latest = data?.data[0];

  const columns: DataTableColumn<EvaluationRun>[] = [
    {
      id: "when",
      header: copy.columns.when,
      cell: (row) => <Waktu value={row.created_at} />,
      width: "w-44",
    },
    {
      id: "scope",
      header: copy.columns.scope,
      cell: (row) => (
        <span className="font-medium text-ink">
          {row.scenario ? row.scenario.name : copy.allLabeled}
        </span>
      ),
    },
    {
      id: "posts",
      header: copy.columns.posts,
      cell: (row) => (
        <span className="font-mono text-table tabular-nums text-ink">{row.labeled_posts}</span>
      ),
      align: "right",
      width: "w-24",
    },
    {
      id: "precision",
      header: copy.columns.precision,
      cell: (row) => (
        <span className="font-mono text-table tabular-nums text-ink">{formatPercent(row.precision)}</span>
      ),
      align: "right",
      width: "w-24",
    },
    {
      id: "recall",
      header: copy.columns.recall,
      cell: (row) => (
        <span className="font-mono text-table tabular-nums text-ink">{formatPercent(row.recall)}</span>
      ),
      align: "right",
      width: "w-24",
    },
    {
      id: "f1",
      header: copy.columns.f1,
      cell: (row) => (
        <span className="font-mono text-table font-semibold tabular-nums text-brand">{formatPercent(row.f1)}</span>
      ),
      align: "right",
      width: "w-24",
    },
    {
      id: "change",
      header: copy.columns.change,
      cell: (row) => {
        const index = data ? data.data.findIndex((r) => r.id === row.id) : -1;
        const change = data && index >= 0 ? f1Change(data.data, index) : null;
        return (
          <span className="font-mono text-caption tabular-nums text-ink-muted">
            {change === null ? copy.changeNone : `${change > 0 ? "+" : ""}${change.toLocaleString("id-ID")} poin`}
          </span>
        );
      },
      width: "w-28",
    },
    {
      id: "latency",
      header: copy.columns.latency,
      cell: (row) => (
        <span className="font-mono text-caption tabular-nums text-ink-muted">{latencyText(row)}</span>
      ),
      width: "w-28",
    },
    {
      id: "by",
      header: copy.columns.by,
      cell: (row) => (
        <span className="text-table text-ink-muted">{row.run_by ?? ui.common.none}</span>
      ),
      width: "w-32",
    },
  ];

  return (
    <div>
      <PageHeader
        title={copy.title}
        subtitle={copy.intro}
        icon={<BarChart2 className="size-6 text-brand" aria-hidden="true" />}
      />

      {error && (
        <div className="mb-6">
          <ErrorState title={ui.common.loadError} onRetry={reload} />
        </div>
      )}

      <Can permission="evaluation.run">
        <RunForm scenarios={data?.meta.scenarios ?? []} onDone={reload} />
      </Can>

      {data === null ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="h-24 animate-pulse rounded-control bg-line" />
            <div className="h-24 animate-pulse rounded-control bg-line" />
            <div className="h-24 animate-pulse rounded-control bg-line" />
            <div className="h-24 animate-pulse rounded-control bg-line" />
          </div>
          <SkeletonRows columns={9} />
        </div>
      ) : !latest ? (
        <p className="text-sm text-ink-muted">{copy.empty}</p>
      ) : (
        <div className="space-y-6">
          <Section title={copy.latest} description={copy.counts(latest.tp, latest.fp, latest.fn, latest.labeled_posts)}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label={copy.metrics.precision} value={formatPercent(latest.precision)} />
              <Stat label={copy.metrics.recall} value={formatPercent(latest.recall)} />
              <Stat label={copy.metrics.f1} value={formatPercent(latest.f1)} />
              <Stat label={copy.metrics.latency} value={latencyText(latest)} />
            </div>
            {latest.notes.length > 0 && (
              <div className="mt-4 space-y-1">
                {latest.notes.map((note) => (
                  <p key={note} className="text-caption text-sev-medium">
                    {describeNote(note)}
                  </p>
                ))}
              </div>
            )}
          </Section>

          <Section flush title={copy.history} description="Riwayat eksekusi pengujian metrik presisi dan recall.">
            <DataTable
              columns={columns}
              rows={data.data}
              getRowKey={(row) => row.id}
              caption="Tabel riwayat evaluasi deteksi"
              framed={false}
            />
          </Section>
        </div>
      )}

      <div className="mt-6">
        <Section title={copy.limitsTitle}>
          <div className="mb-2">
            <SimBadge />
          </div>
          <ul className="max-w-3xl list-disc space-y-1.5 pl-5 text-sm text-ink-muted">
            {copy.limits.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </Section>
      </div>
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
    <div className="mb-6 rounded-control border border-line bg-panel p-4">
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="block">
          <span className="mb-1 block font-medium text-ink">{copy.scenario}</span>
          <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} className={controlClass}>
            <option value="">{copy.allLabeled}</option>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <Button variant="primary" pending={busy} onClick={run}>
          <Play className="size-4" aria-hidden="true" />
          <span>{busy ? copy.running : copy.run}</span>
        </Button>
      </div>
      {error && (
        <div className="mt-2">
          <FieldError>{error}</FieldError>
        </div>
      )}
    </div>
  );
}
