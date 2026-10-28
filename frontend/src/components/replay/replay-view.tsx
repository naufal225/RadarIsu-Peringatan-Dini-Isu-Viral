"use client";

import { CircleCheck, CirclePause, CirclePlay, CircleX, Clock, LoaderCircle, type LucideIcon } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/radar/button";
import { ConfirmDialog } from "@/components/radar/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/radar/data-table";
import { controlClass, Field, FieldError, fileInputClass } from "@/components/radar/form";
import { PageHeader } from "@/components/radar/page-header";
import { ProblemTable } from "@/components/radar/problem-table";
import { Section } from "@/components/radar/section";
import { SimBadge, SimulationBanner } from "@/components/radar/simulation";
import { SkeletonCard } from "@/components/radar/skeleton";
import { EmptyState } from "@/components/radar/states";
import { Waktu } from "@/components/radar/waktu";
import type { ReplayListResponse, ReplayScenario, ReplayStatus } from "@/lib/api-types/replay";
import { cn } from "@/lib/cn";
import { formatInteger } from "@/lib/format";
import { describeErrorCode, ui } from "@/lib/labels";
import { replayStatusLabels } from "@/lib/labels/replay";
import { availableAction, isRunning, isValidSpeed, OPTIONAL_COLUMNS, progressPercent, REQUIRED_COLUMNS } from "@/lib/replay";

const copy = ui.replay;

const STATUS_ICON: Record<ReplayStatus, LucideIcon> = {
  idle: Clock,
  running: LoaderCircle,
  finished: CircleCheck,
  stopped: CirclePause,
};

/** Status skenario: monokrom (kontur, ikon, teks); berhenti karena galat diberi ikon galat. */
export function ReplayStatusChip({ scenario }: { scenario: Pick<ReplayScenario, "status" | "error"> }) {
  const failed = scenario.status === "stopped" && !!scenario.error;
  const Icon = failed ? CircleX : STATUS_ICON[scenario.status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-badge border bg-panel px-2 py-0.5 text-table font-medium",
        failed ? "border-sev-high text-sev-high" : "border-line-input text-ink",
      )}
    >
      <Icon aria-hidden="true" className={cn("size-3.5", scenario.status === "running" && "motion-safe:animate-spin")} />
      {replayStatusLabels[scenario.status]}
    </span>
  );
}

/** A scenario that never ran has no progress to show; a bar at 0% would only be noise. */
const neverRan = (scenario: ReplayScenario) => scenario.run_number === 0 && !isRunning(scenario);

function Bar({ scenario, className }: { scenario: ReplayScenario; className: string }) {
  const percent = progressPercent(scenario);
  return (
    <div
      className={cn("w-full overflow-hidden rounded-badge", className)}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={copy.progress(scenario.progress_rows, scenario.total_rows)}
      aria-label={copy.columns.progress}
    >
      <div className="h-full bg-brand transition-[width] duration-150" style={{ width: `${percent}%` }} />
    </div>
  );
}

/** Progres ringkas di tabel: bar + persen. Track memakai --line agar tetap terlihat di baris terpilih. */
function ProgressCell({ scenario }: { scenario: ReplayScenario }) {
  if (neverRan(scenario)) return <span className="text-ink-muted">{ui.common.none}</span>;
  return (
    <div className="flex items-center gap-2">
      <Bar scenario={scenario} className="h-1.5 bg-line" />
      <span className="w-10 shrink-0 text-right font-mono text-caption tabular-nums text-ink-muted">{copy.percent(progressPercent(scenario))}</span>
    </div>
  );
}

/** Progres besar di panel kontrol: persen sebagai angka utama, jumlah baris di sampingnya. */
function ProgressPanel({ scenario }: { scenario: ReplayScenario }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-metric font-semibold tabular-nums text-ink">{copy.percent(progressPercent(scenario))}</span>
        <span className="font-mono text-table tabular-nums text-ink-muted">{copy.progress(scenario.progress_rows, scenario.total_rows)}</span>
      </div>
      <Bar scenario={scenario} className="h-2.5 bg-brand-tint" />
    </div>
  );
}

export type UploadState = {
  busy: boolean;
  /** 422 per-field codes (name, description, incident_start_offset_seconds, default_speed_factor). */
  fields: Record<string, string[]>;
  /** File-level code, e.g. invalid_rows, missing_columns:text. */
  file: string[];
  rows: { line: string; code: string }[];
  /** Name of the scenario just stored. */
  done: string | null;
  failed: boolean;
};

export const EMPTY_UPLOAD: UploadState = { busy: false, fields: {}, file: [], rows: [], done: null, failed: false };

export type ReplayViewProps = {
  result: ReplayListResponse | null;
  loading: boolean;
  failed: boolean;
  onRetry?: () => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
  speed: string;
  onSpeedChange: (value: string) => void;
  /** Which confirmation is open. */
  confirming: "start" | "stop" | null;
  onAsk: (action: "start" | "stop") => void;
  onCancel: () => void;
  onConfirm: () => void;
  actionPending: boolean;
  /** Codes from a 409/422 on start/stop (e.g. already_running). */
  actionErrors: string[];
  upload: UploadState;
  onUpload: (form: FormData) => void;
};

/**
 * Presentasi murni halaman Replay. Daftar skenario dan kontrol skenario terpilih berdampingan
 * (kontrol menempel di kanan pada layar lebar), unggah CSV di bawah.
 */
export function ReplayView(props: ReplayViewProps) {
  const { result, loading, failed, onRetry, selectedId, onSelect } = props;
  const scenarios = result?.data ?? [];
  const selected = scenarios.find((s) => s.id === selectedId) ?? null;
  const running = scenarios.find(isRunning) ?? null;
  const clock = result?.meta.clock_now ?? null;
  const initialLoad = loading && result === null;
  // Tanpa skenario, panel kontrol tidak punya isi: tabel dan ajakan unggah memakai lebar penuh.
  const showControls = initialLoad || scenarios.length > 0;

  const columns: DataTableColumn<ReplayScenario>[] = [
    {
      id: "name",
      header: copy.columns.name,
      cell: (s) => (
        <div className="py-2">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              aria-pressed={s.id === selectedId}
              className="text-left font-medium text-brand underline-offset-2 hover:underline"
            >
              {s.name}
            </button>
            <SimBadge />
          </span>
          {s.description && <p className="mt-0.5 line-clamp-2 text-caption text-ink-muted">{s.description}</p>}
        </div>
      ),
    },
    { id: "rows", header: copy.columns.rows, cell: (s) => formatInteger(s.total_rows), align: "right", mono: true },
    { id: "status", header: copy.columns.status, cell: (s) => <ReplayStatusChip scenario={s} /> },
    { id: "progress", header: copy.columns.progress, cell: (s) => <ProgressCell scenario={s} />, width: "w-36" },
  ];

  return (
    <>
      {/* Jam data hanya tampil bila payload menyediakannya (meta.clock_now selama Replay berjalan). */}
      {clock && (
        <div className="mb-6 overflow-hidden rounded-control">
          <SimulationBanner dataClock={clock} />
        </div>
      )}

      <PageHeader title={copy.title} subtitle={copy.subtitle} meta={clock ? copy.dataClockNote : copy.clockIdle} />

      <div className={cn("grid items-start gap-x-6", showControls && "xl:grid-cols-12")}>
        <Section title={copy.scenarios} flush className={cn(showControls && "xl:col-span-7")}>
          <DataTable
            framed={false}
            columns={columns}
            rows={scenarios}
            getRowKey={(s) => s.id}
            rowSelected={(s) => s.id === selectedId}
            loading={initialLoad}
            error={failed ? { onRetry } : null}
            caption={copy.tableCaption}
            empty={<EmptyState title={copy.empty} />}
          />
        </Section>

        {showControls && (
          <Section title={copy.controls} className="xl:sticky xl:top-6 xl:col-span-5">
            {initialLoad ? (
              <SkeletonCard framed={false} />
            ) : selected ? (
              <Controls {...props} scenario={selected} running={running} />
            ) : (
              <p className="text-sm text-ink-muted">{copy.noSelection}</p>
            )}
          </Section>
        )}
      </div>

      <Section title={copy.upload.title}>
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <UploadForm state={props.upload} onUpload={props.onUpload} />
          </div>
          <FormatGuide />
        </div>
      </Section>

      <p className="text-caption text-ink-muted">
        {copy.workers} <code className="rounded-badge bg-hover px-1.5 py-0.5 font-mono text-ink">{copy.workersCommand}</code>
      </p>
    </>
  );
}

function Controls({
  scenario,
  running,
  onSelect,
  speed,
  onSpeedChange,
  confirming,
  onAsk,
  onCancel,
  onConfirm,
  actionPending,
  actionErrors,
}: ReplayViewProps & { scenario: ReplayScenario; running: ReplayScenario | null }) {
  const anotherRunning = !!running && running.id !== scenario.id;
  const action = availableAction(scenario, anotherRunning);
  const speedOk = isValidSpeed(speed);
  const live = isRunning(scenario);
  const fresh = neverRan(scenario);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="mr-1 text-section font-semibold text-ink">{scenario.name}</h3>
          <ReplayStatusChip scenario={scenario} />
          <SimBadge />
        </div>
        {scenario.description && <p className="mt-1 text-sm text-ink-muted">{scenario.description}</p>}
      </div>

      {!fresh && <ProgressPanel scenario={scenario} />}

      <dl className={cn("grid grid-cols-2 gap-x-4 gap-y-3 text-table", !fresh && "border-t border-line pt-4")}>
        <Term label={copy.totalRows}>
          <span className="font-mono tabular-nums">{formatInteger(scenario.total_rows)}</span>
        </Term>
        <Term label={copy.incident}>
          {scenario.incident_start_offset_seconds === null ? ui.common.none : copy.incidentAt(formatInteger(scenario.incident_start_offset_seconds))}
        </Term>
        {/* Skenario yang belum pernah jalan tidak punya kecepatan, putaran, atau waktu: tidak ditampilkan sebagai deretan "—". */}
        {!fresh && (
          <>
            <Term label={copy.speedRun}>
              <span className="font-mono">{scenario.speed_factor ? copy.speedValue(scenario.speed_factor) : ui.common.none}</span> · {copy.runNumber(scenario.run_number)}
            </Term>
            <Term label={copy.times2.anchor}>
              <Waktu value={scenario.virtual_anchor_at} />
            </Term>
            <Term label={copy.times2.started}>
              <Waktu value={scenario.started_at} />
            </Term>
            {live ? (
              // Detak menunjukkan pekerja antrean masih hidup selama Replay berjalan.
              <Term label={copy.times2.heartbeat}>
                <Waktu value={scenario.heartbeat_at} />
              </Term>
            ) : (
              <Term label={copy.times2.finished}>
                <Waktu value={scenario.finished_at} />
              </Term>
            )}
          </>
        )}
      </dl>

      {scenario.error && (
        <p className="flex items-start gap-1.5 text-table text-sev-high">
          <CircleX aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {copy.error}: {describeErrorCode(scenario.error)}
        </p>
      )}

      <div className="space-y-3 border-t border-line pt-4">
        {action === "stop" ? (
          <Button variant="destructive" onClick={() => onAsk("stop")} pending={actionPending}>
            <CirclePause aria-hidden="true" className="size-4" />
            {copy.stop}
          </Button>
        ) : action === "blocked" && running ? (
          <>
            <p className="text-table text-ink-muted">{copy.anotherRunningHint}</p>
            <Button onClick={() => onSelect(running.id)}>{copy.showRunning}</Button>
          </>
        ) : (
          <div className="flex flex-wrap items-start gap-3">
            <div className="w-40">
              <Field label={copy.speedLabel} error={speedOk ? null : copy.invalidSpeed}>
                <input name="speed_factor" inputMode="numeric" value={speed} onChange={(e) => onSpeedChange(e.target.value)} aria-invalid={!speedOk} className={cn(controlClass, "font-mono")} />
              </Field>
            </div>
            <Button variant="primary" onClick={() => onAsk("start")} disabled={!speedOk} pending={actionPending} className="mt-6">
              <CirclePlay aria-hidden="true" className="size-4" />
              {copy.start}
            </Button>
            <p className="basis-full text-caption text-ink-muted">{copy.speedHint}</p>
          </div>
        )}
        {actionErrors.map((code) => (
          <FieldError key={code}>{describeErrorCode(code)}</FieldError>
        ))}
      </div>

      <ConfirmDialog
        open={confirming === "start"}
        title={copy.confirmStartTitle(scenario.name)}
        description={copy.confirmStartBody(speedOk ? formatInteger(Number(speed)) : speed)}
        confirmLabel={copy.confirmStart}
        pending={actionPending}
        onConfirm={onConfirm}
        onClose={onCancel}
      />
      <ConfirmDialog
        open={confirming === "stop"}
        title={copy.confirmStopTitle(scenario.name)}
        description={copy.confirmStopBody}
        confirmLabel={copy.confirmStop}
        destructive
        pending={actionPending}
        onConfirm={onConfirm}
        onClose={onCancel}
      />
    </div>
  );
}

function Term({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}

/** Panduan format CSV dari kolom importer (ReplayScenarioImporter), bukan satu kalimat panjang. */
function FormatGuide() {
  const notes = copy.upload.columnNotes;
  const list = (title: string, columns: readonly (keyof typeof notes)[]) => (
    <div>
      <h4 className="mb-1.5 text-table font-medium text-ink">{title}</h4>
      <ul className="space-y-1 text-table">
        {columns.map((column) => (
          <li key={column} className="flex flex-wrap items-baseline gap-x-2">
            <code className="font-mono text-ink">{column}</code>
            <span className="text-ink-muted">{notes[column]}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <aside aria-label={copy.upload.format} className="space-y-4 rounded-control bg-paper p-4 lg:col-span-5">
      <h3 className="text-table font-semibold text-ink">{copy.upload.format}</h3>
      {list(copy.upload.required, REQUIRED_COLUMNS)}
      {list(copy.upload.optional, OPTIONAL_COLUMNS)}
      <ul className="list-disc space-y-1 pl-4 text-caption text-ink-muted">
        {copy.upload.rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
    </aside>
  );
}

function UploadForm({ state, onUpload }: { state: UploadState; onUpload: (form: FormData) => void }) {
  const fieldError = (name: string) => {
    const code = state.fields[name]?.[0];
    return code ? describeErrorCode(code) : null;
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onUpload(new FormData(event.currentTarget));
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={copy.upload.file} error={state.file.length ? state.file.map(describeErrorCode).join("; ") : fieldError("file")}>
        <input name="file" type="file" accept=".csv,text/csv" required className={fileInputClass} />
      </Field>
      <Field label={copy.upload.name} error={fieldError("name")}>
        <input name="name" required maxLength={150} className={controlClass} />
      </Field>
      <Field label={copy.upload.description} error={fieldError("description")}>
        <input name="description" maxLength={2000} className={controlClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={copy.upload.incidentStart} error={fieldError("incident_start_offset_seconds")}>
          <input name="incident_start_offset_seconds" inputMode="numeric" className={cn(controlClass, "font-mono")} />
        </Field>
        <Field label={copy.upload.defaultSpeed} error={fieldError("default_speed_factor")}>
          <input name="default_speed_factor" inputMode="numeric" placeholder="60" className={cn(controlClass, "font-mono")} />
        </Field>
      </div>
      <Button type="submit" variant="primary" pending={state.busy}>
        {state.busy ? copy.upload.submitting : copy.upload.submit}
      </Button>
      {state.failed && <FieldError>{ui.common.actionError}</FieldError>}
      {state.done && (
        <p role="status" className="flex items-center gap-1.5 text-table text-ink">
          <CircleCheck aria-hidden="true" className="size-4" />
          {copy.upload.done(state.done)}
        </p>
      )}
      {state.rows.length > 0 && (
        <ProblemTable
          caption={copy.upload.problem}
          rowHeader={copy.upload.row}
          problemHeader={copy.upload.problem}
          rows={state.rows.map((row) => ({ key: `${row.line}:${row.code}`, row: row.line, problem: describeErrorCode(row.code) }))}
          note={state.rows.length >= 50 ? copy.upload.rowsTruncated : undefined}
        />
      )}
    </form>
  );
}
