"use client";

import { Button } from "@/components/radar/button";
import { DataTable, type DataTableColumn } from "@/components/radar/data-table";
import { controlClass, FieldError } from "@/components/radar/form";
import { PageHeader } from "@/components/radar/page-header";
import { Section } from "@/components/radar/section";
import { SimBadge } from "@/components/radar/simulation";
import { SkeletonCard } from "@/components/radar/skeleton";
import { Stat } from "@/components/radar/stat";
import { EmptyState, ErrorState } from "@/components/radar/states";
import { Waktu } from "@/components/radar/waktu";
import { describeNote, f1Change, formatPercent, type EvaluationResponse, type EvaluationRun } from "@/lib/evaluation";
import { ui } from "@/lib/labels";
import { f1Trend } from "@/lib/insight";

const copy = ui.evaluation;

/**
 * Negatif berarti alert terdeteksi sebelum awal insiden (OPEN_QUESTIONS #37): nilainya benar,
 * jadi ditampilkan sebagai jarak dengan keterangan, bukan tanda minus.
 */
function latencyText(run: EvaluationRun): string {
  const seconds = run.detection_latency_seconds;
  if (seconds === null) return copy.latencyNone;
  if (seconds < 0) return copy.latencyBefore(copy.seconds(-seconds));
  return copy.seconds(seconds);
}

type HistoryRow = { run: EvaluationRun; change: number | null };

const HISTORY_COLUMNS: DataTableColumn<HistoryRow>[] = [
  { id: "when", header: copy.columns.when, cell: (r) => <Waktu value={r.run.created_at} /> },
  { id: "scope", header: copy.columns.scope, cell: (r) => r.run.scenario?.name ?? copy.allLabeled },
  { id: "posts", header: copy.columns.posts, mono: true, align: "right", cell: (r) => r.run.labeled_posts },
  { id: "precision", header: copy.columns.precision, mono: true, align: "right", cell: (r) => formatPercent(r.run.precision) },
  { id: "recall", header: copy.columns.recall, mono: true, align: "right", cell: (r) => formatPercent(r.run.recall) },
  { id: "f1", header: copy.columns.f1, mono: true, align: "right", cell: (r) => formatPercent(r.run.f1) },
  {
    id: "change",
    header: copy.columns.change,
    mono: true,
    align: "right",
    cell: (r) => (r.change === null ? copy.changeNone : `${r.change > 0 ? "+" : ""}${r.change.toLocaleString("id-ID")} poin`),
  },
  { id: "latency", header: copy.columns.latency, cell: (r) => latencyText(r.run) },
  { id: "by", header: copy.columns.by, cell: (r) => r.run.run_by ?? ui.common.none },
];

/** Batang F1 per run, kronologis dari kiri. Lebar batang = F1 (0–100%); run tanpa F1 ditandai. */
function F1Trend({ runs }: { runs: EvaluationRun[] }) {
  const points = f1Trend(runs);
  const measured = points.filter((p) => p.f1 !== null);
  return (
    <Section title={copy.trendTitle}>
      {measured.length === 0 ? (
        <p className="text-table text-ink-muted">{copy.trendNone}</p>
      ) : (
        <ol className="space-y-2">
          {points.map((p, index) => (
            <li key={p.id} className="grid grid-cols-[14rem_1fr_4rem] items-center gap-3 text-table">
              <span className="whitespace-nowrap text-ink-muted">
                <Waktu value={p.label} />
              </span>
              <span className="h-2 overflow-hidden rounded-badge bg-hover" role="img" aria-label={`Run ${index + 1}: ${formatPercent(p.f1)}`}>
                {p.f1 !== null && <span className="block h-full bg-brand" style={{ width: `${Math.max(0, Math.min(1, p.f1)) * 100}%` }} />}
              </span>
              <span className="text-right font-mono tabular-nums text-ink">{formatPercent(p.f1)}</span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

export type EvaluationViewProps = {
  data: EvaluationResponse | null;
  failed: boolean;
  onRetry: () => void;
  canRun: boolean;
  running: boolean;
  runError: string | null;
  scenarioId: string;
  onScenarioChange: (id: string) => void;
  onRun: () => void;
};

/** Presentasi murni halaman Evaluasi. Batasan selalu tampil (PRD §15.4). */
export function EvaluationView({
  data,
  failed,
  onRetry,
  canRun,
  running,
  runError,
  scenarioId,
  onScenarioChange,
  onRun,
}: EvaluationViewProps) {
  const latest = data?.data[0] ?? null;
  const history: HistoryRow[] = data ? data.data.map((run, index) => ({ run, change: f1Change(data.data, index) })) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        subtitle={copy.intro}
        actions={
          canRun ? (
            <div className="flex flex-wrap items-end gap-3">
              <label className="block text-table text-ink-muted">
                <span className="mb-1 block">{copy.scenario}</span>
                <select
                  value={scenarioId}
                  onChange={(e) => onScenarioChange(e.target.value)}
                  className={controlClass}
                  disabled={running}
                >
                  <option value="">{copy.allLabeled}</option>
                  {(data?.meta.scenarios ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="primary" pending={running} onClick={onRun}>
                {running ? copy.running : copy.run}
              </Button>
            </div>
          ) : undefined
        }
      />

      {runError && <FieldError>{runError}</FieldError>}

      {failed ? (
        <ErrorState onRetry={onRetry} />
      ) : data === null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : latest === null ? (
        <EmptyState title={copy.empty} />
      ) : (
        <>
          <Section title={copy.latest} description={copy.counts(latest.tp, latest.fp, latest.fn, latest.labeled_posts)}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label={copy.metrics.precision} value={formatPercent(latest.precision)} />
              <Stat label={copy.metrics.recall} value={formatPercent(latest.recall)} />
              <Stat label={copy.metrics.f1} value={formatPercent(latest.f1)} />
              <Stat label={copy.metrics.latency} value={latencyText(latest)} />
            </div>
            {latest.notes.length > 0 && (
              <ul className="mt-4 space-y-1 text-table text-sev-medium">
                {latest.notes.map((note) => (
                  <li key={note}>{describeNote(note)}</li>
                ))}
              </ul>
            )}
          </Section>

          <F1Trend runs={data.data} />

          <Section title={copy.history} flush>
            <DataTable
              caption={copy.history}
              columns={HISTORY_COLUMNS}
              rows={history}
              getRowKey={(r) => r.run.id}
              framed={false}
              loading={false}
            />
          </Section>
        </>
      )}

      <Section title={copy.limitsTitle}>
        <div className="mb-3">
          <SimBadge />
        </div>
        <ul className="max-w-3xl list-disc space-y-1 pl-5 text-table text-ink">
          {copy.limits.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
