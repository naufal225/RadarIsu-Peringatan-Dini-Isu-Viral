"use client";

import { CircleCheck, CircleDashed, CircleX, type LucideIcon } from "lucide-react";
import type { FormEvent } from "react";
import { Button } from "@/components/radar/button";
import { DataTable, type DataTableColumn } from "@/components/radar/data-table";
import { Dialog } from "@/components/radar/dialog";
import { controlClass, Field, FieldError } from "@/components/radar/form";
import { PageHeader } from "@/components/radar/page-header";
import { SimBadge } from "@/components/radar/simulation";
import { EmptyState } from "@/components/radar/states";
import { Waktu } from "@/components/radar/waktu";
import { CREATABLE_SOURCE_TYPES, type ImportBatch, type Source, type SourceList, type SourceStatus, type SourceType } from "@/lib/api-types/sources";
import { cn } from "@/lib/cn";
import { formatInteger } from "@/lib/format";
import { describeErrorCode, sourceStatusLabels, sourceTypeLabels, ui } from "@/lib/labels";
import { canImport, canTest, type SourceFormValues } from "@/lib/sources";

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
    <span className={cn("inline-flex items-center gap-1.5", tone)}>
      <Icon aria-hidden="true" className="size-4" />
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

/** Halaman Polos: komponen fondasi apa adanya (docs/UI_PAGES.md, /admin/sources). */
export function SourcesView(props: SourcesViewProps) {
  const { result, loading, failed, onRetry, canManage, busyId, rowNotice } = props;

  const columns: DataTableColumn<Source>[] = [
    {
      id: "name",
      header: copy.name,
      cell: (s) => (
        <div className="py-1">
          <span className="block font-medium text-ink">{s.name}</span>
          {s.config.url && <span className="block break-all font-mono text-caption text-ink-muted">{s.config.url}</span>}
          {s.config.video_ids && <span className="block font-mono text-caption text-ink-muted">{s.config.video_ids.join(", ")}</span>}
          {s.last_error && <span className="block break-words text-caption text-sev-high">{copy.lastError}: {s.last_error}</span>}
          {rowNotice?.id === s.id && (
            <span className={cn("block text-caption", rowNotice.tone === "error" ? "text-sev-high" : "text-ink")}>{rowNotice.text}</span>
          )}
        </div>
      ),
    },
    {
      id: "type",
      header: copy.type,
      cell: (s) => (
        <span className="flex flex-wrap items-center gap-2">
          {sourceTypeLabels[s.type]}
          {s.is_simulated && <SimBadge />}
        </span>
      ),
    },
    { id: "status", header: copy.status, cell: (s) => <SourceStatusLabel status={s.last_status} /> },
    { id: "checked", header: copy.lastChecked, cell: (s) => <Waktu value={s.last_fetched_at} /> },
    { id: "interval", header: copy.interval, cell: (s) => (s.interval_minutes ? copy.everyMinutes(s.interval_minutes) : copy.noInterval) },
    { id: "active", header: copy.active, cell: (s) => (s.is_active ? copy.yes : copy.no) },
    { id: "raw", header: copy.rawItems, cell: (s) => formatInteger(s.raw_items_count), align: "right", mono: true },
  ];

  if (canManage) {
    columns.push({
      id: "actions",
      header: copy.actions,
      cell: (s) =>
        s.type === "replay" ? null : (
          <span className="flex flex-wrap gap-2 py-1">
            {canTest(s) && (
              <Button onClick={() => props.onTest(s)} pending={busyId === s.id}>
                {busyId === s.id ? copy.testing : copy.test}
              </Button>
            )}
            {canImport(s) && <Button onClick={() => props.onImport(s)}>{copy.import}</Button>}
            <Button onClick={() => props.onEdit(s)}>{copy.edit}</Button>
            <Button onClick={() => props.onToggle(s)} disabled={busyId === s.id}>
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

      <DataTable
        columns={columns}
        rows={result?.data ?? []}
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
          <input type="checkbox" name="is_active" checked={values.is_active} onChange={(e) => set({ is_active: e.target.checked })} />
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
          <input name="file" type="file" accept=".csv,text/csv" required className="block text-sm text-ink" />
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
            <div className="overflow-x-auto rounded-control border border-line">
              <table className="w-full text-left text-table">
                <caption className="sr-only">{copy.problem}</caption>
                <thead className="border-b border-line bg-paper text-ink-muted">
                  <tr>
                    <th scope="col" className="h-9 px-3 font-medium">{copy.row}</th>
                    <th scope="col" className="px-3 font-medium">{copy.problem}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {imports.result.errors.map((e) => (
                    <tr key={`${e.row}:${e.message}`} className="h-9">
                      <td className="px-3 font-mono">{e.row}</td>
                      <td className="px-3">{describeErrorCode(e.message)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {imports.result.failed_rows > imports.result.errors.length && <p className="text-caption text-ink-muted">{copy.errorsTruncated}</p>}
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
