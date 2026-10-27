"use client";

import { CircleCheck, CirclePause, CirclePlay, CircleX, Clock, LoaderCircle, type LucideIcon } from "lucide-react";
import type { FormEvent } from "react";
import { Button } from "@/components/radar/button";
import { ConfirmDialog } from "@/components/radar/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/radar/data-table";
import { controlClass, Field, FieldError } from "@/components/radar/form";
import { PageHeader } from "@/components/radar/page-header";
import { Section } from "@/components/radar/section";
import { SimBadge, SimulationBanner } from "@/components/radar/simulation";
import { EmptyState } from "@/components/radar/states";
import { Waktu } from "@/components/radar/waktu";
import type { ReplayListResponse, ReplayScenario, ReplayStatus } from "@/lib/api-types/replay";
import { cn } from "@/lib/cn";
import { formatInteger } from "@/lib/format";
import { describeErrorCode, ui } from "@/lib/labels";
import { replayStatusLabels } from "@/lib/labels/replay";
import { availableAction, isRunning, isValidSpeed, progressPercent } from "@/lib/replay";

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
        "inline-flex items-center gap-1.5 rounded-badge border bg-panel px-2 py-0.5 text-table font-medium",
        failed ? "border-sev-high text-sev-high" : "border-line-input text-ink",
      )}
    >
      <Icon aria-hidden="true" className={cn("size-3.5", scenario.status === "running" && "motion-safe:animate-spin")} />
      {replayStatusLabels[scenario.status]}
    </span>
  );
}

function ProgressBar({ scenario }: { scenario: ReplayScenario }) {
  const percent = progressPercent(scenario);
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-badge bg-brand-tint" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={copy.columns.progress}>
        <div className="h-full bg-brand" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-caption text-ink-muted">{copy.progress(scenario.progress_rows, scenario.total_rows)}</p>
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

/** Presentasi murni halaman Replay: daftar skenario, kontrol skenario terpilih, dan unggah CSV. */
export function ReplayView(props: ReplayViewProps) {
  const { result, loading, failed, onRetry, selectedId, onSelect } = props;
  const scenarios = result?.data ?? [];
  const selected = scenarios.find((s) => s.id === selectedId) ?? null;
  const running = scenarios.find(isRunning) ?? null;
  const clock = result?.meta.clock_now ?? null;

  const columns: DataTableColumn<ReplayScenario>[] = [
    {
      id: "name",
      header: copy.columns.name,
      cell: (s) => (
        <div className="py-1.5">
          <button type="button" onClick={() => onSelect(s.id)} aria-pressed={s.id === selectedId} className="text-left font-medium text-brand underline-offset-2 hover:underline">
            {s.name}
          </button>
          {s.description && <p className="text-caption text-ink-muted">{s.description}</p>}
        </div>
      ),
    },
    { id: "rows", header: copy.columns.rows, cell: (s) => formatInteger(s.total_rows), align: "right", mono: true },
    { id: "status", header: copy.columns.status, cell: (s) => <ReplayStatusChip scenario={s} /> },
    { id: "progress", header: copy.columns.progress, cell: (s) => <ProgressBar scenario={s} />, width: "w-48" },
    { id: "sim", header: "", cell: () => <SimBadge /> },
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

      <Section title={copy.scenarios}>
        <DataTable
          columns={columns}
          rows={scenarios}
          getRowKey={(s) => s.id}
          rowSelected={(s) => s.id === selectedId}
          loading={loading && result === null}
          error={failed ? { onRetry } : null}
          caption={copy.tableCaption}
          empty={<EmptyState title={copy.empty} />}
        />
      </Section>

      <Section title={copy.controls}>
        {selected ? <Controls {...props} scenario={selected} anotherRunning={!!running && running.id !== selected.id} /> : <p className="text-sm text-ink-muted">{copy.noSelection}</p>}
      </Section>

      <Section title={copy.upload.title} description={copy.upload.format}>
        <UploadForm state={props.upload} onUpload={props.onUpload} />
      </Section>

      <p className="text-caption text-ink-muted">{copy.workers}</p>
    </>
  );
}

function Controls({
  scenario,
  anotherRunning,
  speed,
  onSpeedChange,
  confirming,
  onAsk,
  onCancel,
  onConfirm,
  actionPending,
  actionErrors,
}: ReplayViewProps & { scenario: ReplayScenario; anotherRunning: boolean }) {
  const action = availableAction(scenario, anotherRunning);
  const speedOk = isValidSpeed(speed);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-section font-semibold text-ink">{scenario.name}</h3>
          <ReplayStatusChip scenario={scenario} />
          <SimBadge />
        </div>
        <ProgressBar scenario={scenario} />
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-table">
          <dt className="text-ink-muted">{copy.columns.rows}</dt>
          <dd>{copy.rowsCount(scenario.total_rows, scenario.incident_start_offset_seconds === null ? ui.common.none : formatInteger(scenario.incident_start_offset_seconds))}</dd>
          {scenario.run_number > 0 && (
            <>
              <dt className="text-ink-muted">{copy.columns.speed}</dt>
              <dd>{scenario.speed_factor ? copy.speedValue(scenario.speed_factor) : ui.common.none} · {copy.runNumber(scenario.run_number)}</dd>
            </>
          )}
          <dt className="text-ink-muted">{copy.times2.anchor}</dt>
          <dd><Waktu value={scenario.virtual_anchor_at} /></dd>
          <dt className="text-ink-muted">{copy.times2.started}</dt>
          <dd><Waktu value={scenario.started_at} /></dd>
          <dt className="text-ink-muted">{copy.times2.finished}</dt>
          <dd><Waktu value={scenario.finished_at} /></dd>
        </dl>
        {scenario.error && (
          <p className="flex items-start gap-1.5 text-table text-sev-high">
            <CircleX aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {copy.error}: {describeErrorCode(scenario.error)}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {action === "stop" ? (
          <Button variant="destructive" onClick={() => onAsk("stop")} pending={actionPending}>
            <CirclePause aria-hidden="true" className="size-4" />
            {copy.stop}
          </Button>
        ) : (
          <>
            <div className="max-w-xs">
              <Field label={copy.speedLabel} hint={copy.speedHint} error={speedOk ? null : copy.invalidSpeed}>
                <input name="speed_factor" inputMode="numeric" value={speed} onChange={(e) => onSpeedChange(e.target.value)} aria-invalid={!speedOk} className={controlClass} />
              </Field>
            </div>
            <Button variant="primary" onClick={() => onAsk("start")} disabled={action === "blocked" || !speedOk} pending={actionPending}>
              <CirclePlay aria-hidden="true" className="size-4" />
              {copy.start}
            </Button>
            {action === "blocked" && <p className="text-table text-ink-muted">{copy.anotherRunningHint}</p>}
          </>
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
    <form onSubmit={submit} className="max-w-2xl space-y-4">
      <Field label={copy.upload.file} error={state.file.length ? state.file.map(describeErrorCode).join("; ") : fieldError("file")}>
        <input name="file" type="file" accept=".csv,text/csv" required className="block text-sm text-ink file:mr-3 file:h-9 file:rounded-control file:border file:border-line-input file:bg-panel file:px-3 file:text-sm file:text-ink" />
      </Field>
      <Field label={copy.upload.name} error={fieldError("name")}>
        <input name="name" required maxLength={150} className={controlClass} />
      </Field>
      <Field label={copy.upload.description} error={fieldError("description")}>
        <input name="description" maxLength={2000} className={controlClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={copy.upload.incidentStart} error={fieldError("incident_start_offset_seconds")}>
          <input name="incident_start_offset_seconds" inputMode="numeric" className={controlClass} />
        </Field>
        <Field label={copy.upload.defaultSpeed} error={fieldError("default_speed_factor")}>
          <input name="default_speed_factor" inputMode="numeric" placeholder="60" className={controlClass} />
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
        <div className="overflow-x-auto rounded-control border border-line">
          <table className="w-full text-left text-table">
            <caption className="sr-only">{copy.upload.problem}</caption>
            <thead className="border-b border-line bg-paper text-ink-muted">
              <tr>
                <th scope="col" className="h-9 px-3 font-medium">{copy.upload.row}</th>
                <th scope="col" className="px-3 font-medium">{copy.upload.problem}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {state.rows.map((row) => (
                <tr key={`${row.line}:${row.code}`} className="h-9">
                  <td className="px-3 font-mono">{row.line}</td>
                  <td className="px-3">{describeErrorCode(row.code)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {state.rows.length >= 50 && <p className="px-3 py-2 text-caption text-ink-muted">{copy.upload.rowsTruncated}</p>}
        </div>
      )}
    </form>
  );
}
