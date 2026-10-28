"use client";

import { CircleCheck, CircleDashed, CircleX, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { FormEvent } from "react";
import { Button } from "@/components/radar/button";
import { DataTable, type DataTableColumn } from "@/components/radar/data-table";
import { Dialog } from "@/components/radar/dialog";
import { checkboxClass, controlClass, Field, FieldError, fileInputClass } from "@/components/radar/form";
import { PageHeader } from "@/components/radar/page-header";
import { ProblemTable } from "@/components/radar/problem-table";
import { SimBadge } from "@/components/radar/simulation";
import { EmptyState } from "@/components/radar/states";
import { Waktu } from "@/components/radar/waktu";
import { CREATABLE_SOURCE_TYPES, type ImportBatch, type Source, type SourceList, type SourceStatus, type SourceType } from "@/lib/api-types/sources";
import { cn } from "@/lib/cn";
import { formatInteger } from "@/lib/format";
import { describeErrorCode, sourceStatusLabels, sourceTypeLabels, ui } from "@/lib/labels";
import { canImport, canTest, sourceSummary, type SourceFormValues } from "@/lib/sources";

const copy = ui.sources;

const STATUS: Record<SourceStatus, { icon: LucideIcon; tone: string }> = {
  never: { icon: CircleDashed, tone: "text-ink-muted" },
  ok: { icon: CircleCheck, tone: "text-ink" },
  error: { icon: CircleX, tone: "text-sev-high" },
};

/** Status sumber: ikon + teks; `ok` netral bercentang (tanpa hijau), `error` merah. */
function SourceStatusLabel({ status }: { status: SourceStatus }) {
  const { icon: Icon, tone } = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", tone)}>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {sourceStatusLabels[status]}
    </span>
  );
}

export type SourceFormState = {
  open: boolean;
  mode: "create" | "edit";
  sourceId: number | null;
  values: SourceFormValues;
  errors: Record<string, string[]>;
  pending: boolean;
  failed: boolean;
};

export type ImportState = {
  source: Source | null;
  pending: boolean;
  result: ImportBatch | null;
  /** 422 code for the whole file (e.g. missing_columns:text). */
  fileErrors: string[];
  failed: boolean;
  history: ImportBatch[] | null;
};

export type SourcesViewProps = {
  result: SourceList | null;
  loading: boolean;
  failed: boolean;
  onRetry?: () => void;
  canManage: boolean;
  /** Id of the row whose action is running. */
  busyId: number | null;
  /** Inline message per row after a test or a failed action. */
  rowNotice: { id: number; tone: "ok" | "error"; text: string } | null;
  onTest: (source: Source) => void;
  onToggle: (source: Source) => void;
  onEdit: (source: Source) => void;
  onNew: () => void;
  onImport: (source: Source) => void;
  form: SourceFormState;
  onFormChange: (values: SourceFormValues) => void;
  onFormSubmit: () => void;
  onFormClose: () => void;
  imports: ImportState;
  onImportSubmit: (form: FormData) => void;
  onImportClose: () => void;
};

/** Ringkasan satu baris di atas tabel: fakta dari daftar (tidak dipaginasi), galat disorot dengan ikon + teks. */
function Summary({ sources }: { sources: Source[] }) {
  const summary = sourceSummary(sources);
  const text = copy.summary;
  return (
    <p aria-label={text.label} className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-table text-ink-muted">
      <span>{text.total(formatInteger(summary.total))}</span>
      <span aria-hidden="true">·</span>
      <span>{text.active(formatInteger(summary.active))}</span>
      <span aria-hidden="true">·</span>
      <span>{text.rawItems(formatInteger(summary.rawItems))}</span>
      <span aria-hidden="true">·</span>
      {summary.failing > 0 ? (
        <span className="inline-flex items-center gap-1 font-medium text-sev-high">
          <CircleX aria-hidden="true" className="size-3.5" />
          {text.failing(formatInteger(summary.failing))}
        </span>
      ) : (
        <span>{text.noneFailing}</span>
      )}
    </p>
  );
}

/** Rincian konfigurasi satu baris (URL feed atau jumlah video), utuh di tooltip. */
function ConfigLine({ source }: { source: Source }) {
  const full = source.config.url ?? source.config.video_ids?.join(", ");
  if (!full) return null;
  return (
    <span title={full} className="block max-w-52 truncate font-mono text-caption text-ink-muted">
      {source.config.url ?? copy.videoCount(source.config.video_ids?.length ?? 0)}
    </span>
  );
}

/** Halaman Polos dengan komponen fondasi (docs/UI_PAGES.md, /admin/sources). */
export function SourcesView(props: SourcesViewProps) {
  const { result, loading, failed, onRetry, canManage, busyId, rowNotice } = props;
  const sources = result?.data ?? [];

  const columns: DataTableColumn<Source>[] = [
    {
      id: "name",
      header: copy.name,
      cell: (s) => (
        <div className="py-2">
          <span className={cn("block font-medium", s.is_active ? "text-ink" : "text-ink-muted")}>{s.name}</span>
          <ConfigLine source={s} />
        </div>
      ),
    },
    {
      id: "type",
      header: copy.type,
      cell: (s) => (
        <span className="flex flex-wrap items-center gap-2 whitespace-nowrap">
          {sourceTypeLabels[s.type]}
          {s.is_simulated && <SimBadge />}
        </span>
      ),
    },
    {
      // Status, waktu cek, galat terakhir, dan hasil uji dalam satu kolom: satu cerita per sumber.
      id: "status",
      header: copy.status,
      cell: (s) => (
        <div className="max-w-64 py-2">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <SourceStatusLabel status={s.last_status} />
            {s.last_fetched_at && <Waktu value={s.last_fetched_at} className="text-caption text-ink-muted" />}
          </span>
          {s.last_error && (
            <span title={s.last_error} className="mt-0.5 line-clamp-2 break-words text-caption text-sev-high">
              {copy.lastError}: {s.last_error}
            </span>
          )}
          {rowNotice?.id === s.id && (
            <span role="status" className={cn("mt-0.5 flex items-center gap-1 text-caption", rowNotice.tone === "error" ? "text-sev-high" : "text-ink")}>
              {rowNotice.tone === "error" ? <CircleX aria-hidden="true" className="size-3.5 shrink-0" /> : <CircleCheck aria-hidden="true" className="size-3.5 shrink-0" />}
              {rowNotice.text}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "pull",
      header: copy.pull,
      cell: (s) => (
        <span className="whitespace-nowrap">
          {s.is_active ? copy.active : <span className="text-ink-muted">{copy.inactive}</span>}
          {s.is_active && s.interval_minutes && <span className="block text-caption text-ink-muted">{copy.everyMinutes(s.interval_minutes)}</span>}
        </span>
      ),
    },
    { id: "raw", header: copy.rawItems, cell: (s) => <span className="whitespace-nowrap">{formatInteger(s.raw_items_count)}</span>, align: "right", mono: true },
  ];

  if (canManage) {
    columns.push({
      id: "actions",
      header: <span className="sr-only">{copy.actions}</span>,
      align: "right",
      cell: (s) =>
        s.type === "replay" ? (
          <Link href="/admin/replay" className="inline-block max-w-32 text-caption text-brand underline-offset-2 hover:underline">
            {copy.managedByReplay}
          </Link>
        ) : (
          <span className="flex flex-wrap justify-end gap-1.5 py-1 xl:flex-nowrap">
            {canTest(s) && (
              <Button size="sm" onClick={() => props.onTest(s)} pending={busyId === s.id}>
                {busyId === s.id ? copy.testing : copy.test}
              </Button>
            )}
            {canImport(s) && (
              <Button size="sm" onClick={() => props.onImport(s)}>
                {copy.import}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => props.onEdit(s)}>
              {copy.edit}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => props.onToggle(s)} disabled={busyId === s.id}>
              {s.is_active ? ui.common.deactivate : ui.common.activate}
            </Button>
          </span>
        ),
    });
  }

  return (
    <>
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        meta={copy.ingestLater}
        actions={canManage ? <Button variant="primary" onClick={props.onNew}>{copy.newSource}</Button> : undefined}
      />

      {sources.length > 0 && <Summary sources={sources} />}

      <DataTable
        columns={columns}
        rows={sources}
        getRowKey={(s) => s.id}
        loading={loading && result === null}
        error={failed ? { onRetry } : null}
        caption={copy.tableCaption}
        empty={<EmptyState title={copy.empty} />}
      />

      {canManage && <SourceFormDialog {...props} />}
      {canManage && <ImportDialog {...props} />}
    </>
  );
}

function SourceFormDialog({ form, onFormChange, onFormSubmit, onFormClose }: SourcesViewProps) {
  const { values, errors } = form;
  const set = (patch: Partial<SourceFormValues>) => onFormChange({ ...values, ...patch });
  const err = (field: string) => (errors[field]?.length ? errors[field].map(describeErrorCode).join("; ") : null);
  const pulls = values.type === "rss" || values.type === "youtube";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onFormSubmit();
  }

  return (
    <Dialog open={form.open} title={form.mode === "create" ? copy.newSource : copy.editSource} onClose={onFormClose}>
      <form onSubmit={submit} className="space-y-4">
        {form.mode === "create" && (
          <Field label={copy.type} error={err("type")}>
            <select name="type" value={values.type} onChange={(e) => set({ type: e.target.value as SourceType })} className={controlClass}>
              {CREATABLE_SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {sourceTypeLabels[t]}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={copy.name} error={err("name")}>
          <input name="name" required maxLength={120} value={values.name} onChange={(e) => set({ name: e.target.value })} className={controlClass} />
        </Field>
        {values.type === "rss" && (
          <>
            <Field label={copy.url} error={err("url")}>
              <input name="url" type="url" required placeholder="https://" value={values.url} onChange={(e) => set({ url: e.target.value })} className={controlClass} />
            </Field>
            <Field label={copy.maxItems} error={err("max_items")}>
              <input name="max_items" type="number" min={1} max={200} value={values.max_items} onChange={(e) => set({ max_items: e.target.value })} className={controlClass} />
            </Field>
          </>
        )}
        {values.type === "youtube" && (
          <Field label={copy.videoIds} error={err("video_ids")}>
            <textarea name="video_ids" required rows={3} value={values.video_ids} onChange={(e) => set({ video_ids: e.target.value })} className={cn(controlClass, "h-auto py-2 font-mono")} />
          </Field>
        )}
        {pulls && (
          <Field label={copy.interval} error={err("interval_minutes")}>
            <input name="interval_minutes" type="number" min={5} max={1440} required value={values.interval_minutes} onChange={(e) => set({ interval_minutes: e.target.value })} className={controlClass} />
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="is_active" checked={values.is_active} onChange={(e) => set({ is_active: e.target.checked })} className={checkboxClass} />
          {copy.isActive}
        </label>
        {form.failed && <FieldError>{ui.common.actionError}</FieldError>}
        <div className="flex justify-end gap-2">
          <Button onClick={onFormClose} disabled={form.pending}>
            {copy.close}
          </Button>
          <Button type="submit" variant="primary" pending={form.pending}>
            {form.pending ? copy.saving : copy.save}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ImportDialog({ imports, onImportSubmit, onImportClose }: SourcesViewProps) {
  const source = imports.source;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onImportSubmit(new FormData(event.currentTarget));
  }

  return (
    <Dialog open={source !== null} title={source ? copy.importTitle(source.name) : copy.import} onClose={onImportClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-caption text-ink-muted">{copy.csvFormat}</p>
        <Field label={copy.file} error={imports.fileErrors.length ? imports.fileErrors.map(describeErrorCode).join("; ") : null}>
          <input name="file" type="file" accept=".csv,text/csv" required className={fileInputClass} />
        </Field>
        <Button type="submit" variant="primary" pending={imports.pending}>
          {imports.pending ? copy.uploading : copy.upload}
        </Button>
        {imports.failed && <FieldError>{ui.common.actionError}</FieldError>}
      </form>

      {imports.result && (
        <div role="status" className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <p className="font-medium text-ink">
            {copy.importResult}: <span className="font-mono">{imports.result.filename}</span>
          </p>
          <p className="text-ink">
            {copy.total} {formatInteger(imports.result.total_rows)} · {copy.success} {formatInteger(imports.result.success_rows)} · {copy.failed}{" "}
            {formatInteger(imports.result.failed_rows)}
          </p>
          {imports.result.errors.length > 0 && (
            <ProblemTable
              caption={copy.problem}
              rowHeader={copy.row}
              problemHeader={copy.problem}
              rows={imports.result.errors.map((e) => ({ key: `${e.row}:${e.message}`, row: e.row, problem: describeErrorCode(e.message) }))}
              note={imports.result.failed_rows > imports.result.errors.length ? copy.errorsTruncated : undefined}
            />
          )}
        </div>
      )}

      {imports.history && imports.history.length > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          <h3 className="mb-2 text-table font-semibold text-ink">{copy.importHistory}</h3>
          <ul className="space-y-1 text-table">
            {imports.history.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-3">
                <Waktu value={b.created_at} />
                <span className="font-mono">{b.filename}</span>
                <span className="text-ink-muted">
                  {formatInteger(b.success_rows)}/{formatInteger(b.total_rows)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
