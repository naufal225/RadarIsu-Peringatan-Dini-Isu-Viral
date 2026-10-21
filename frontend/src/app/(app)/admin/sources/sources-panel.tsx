"use client";

import { useState, type FormEvent } from "react";
import { Can } from "@/components/permissions-provider";
import { Button, ErrorText, Field, FieldErrors, inputClass, PageTitle, Section, StatusBadge, Table, Td } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, invalidFields } from "@/lib/format";
import { describeErrorCode, sourceStatusLabels, sourceTypeLabels, ui } from "@/lib/labels";
import { useApiData } from "@/lib/use-api-data";

type SourceType = keyof typeof sourceTypeLabels;
type SourceStatus = keyof typeof sourceStatusLabels;

type Source = {
  id: number;
  type: SourceType;
  name: string;
  config: { url?: string; max_items?: number; video_ids?: string[] };
  interval_minutes: number | null;
  is_active: boolean;
  last_status: SourceStatus;
  last_fetched_at: string | null;
  last_error: string | null;
  raw_items_count: number;
};

type ImportBatch = {
  id: number;
  filename: string;
  total_rows: number;
  success_rows: number;
  failed_rows: number;
  errors: { row: number; message: string }[];
  created_at: string;
};

const CREATABLE_TYPES: SourceType[] = ["rss", "youtube", "csv"];

/** 422 messages from the API are error codes (see labels.errorCodeLabels). */
function errorMessages(e: unknown): string {
  if (e instanceof ApiError && e.status === 422) {
    return Object.values(e.body?.errors ?? {}).flat().map(describeErrorCode).join("; ");
  }
  return ui.common.actionError;
}

export function SourcesPanel() {
  const { data, error, reload } = useApiData<{ data: Source[] }>("sources");
  const sources = data?.data ?? null;

  return (
    <>
      <PageTitle>{ui.sources.title}</PageTitle>
      <p className="mb-4 text-sm text-neutral-600">{ui.sources.ingestLater}</p>
      <ErrorText>{error ? ui.common.loadError : null}</ErrorText>

      {sources === null ? (
        <p className="text-sm text-neutral-500">{ui.loading}</p>
      ) : sources.length === 0 ? (
        <p className="mb-8 text-sm text-neutral-500">{ui.common.empty}</p>
      ) : (
        <div className="mb-8 space-y-4">
          {sources.map((source) => (
            <SourceCard key={source.id} source={source} onChanged={reload} />
          ))}
        </div>
      )}

      <Can permission="sources.manage">
        <Section title={ui.sources.newSource}>
          <NewSourceForm onCreated={reload} />
        </Section>
      </Can>
    </>
  );
}

function SourceCard({ source, onChanged }: { source: Source; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<ImportBatch | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (e) {
      setError(errorMessages(e));
    } finally {
      setBusy(false);
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await run(async () => {
      const result = await api<{ data: ImportBatch }>(`sources/${source.id}/import`, {
        method: "POST",
        body: new FormData(form),
      });
      setLastImport(result.data);
      setHistoryKey((k) => k + 1);
      form.reset();
    });
  }

  const tone = source.last_status === "ok" ? "ok" : source.last_status === "error" ? "error" : "muted";

  return (
    <article className="rounded-md border border-neutral-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">
            {source.name} <span className="text-sm font-normal text-neutral-500">· {sourceTypeLabels[source.type]}</span>
          </h3>
          <p className="text-sm text-neutral-600">
            {source.config.url ?? source.config.video_ids?.join(", ") ?? ""}
            {source.interval_minutes ? ` · ${ui.sources.everyMinutes(source.interval_minutes)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge tone={tone}>{sourceStatusLabels[source.last_status]}</StatusBadge>
          <StatusBadge tone={source.is_active ? "ok" : "muted"}>
            {source.is_active ? ui.common.active : ui.common.inactive}
          </StatusBadge>
        </div>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 text-sm sm:grid-cols-3">
        <dt className="text-neutral-500">{ui.sources.lastChecked}</dt>
        <dd className="sm:col-span-2">{formatDateTime(source.last_fetched_at)}</dd>
        <dt className="text-neutral-500">{ui.sources.rawItems}</dt>
        <dd className="sm:col-span-2">{source.raw_items_count}</dd>
        {source.last_error && (
          <>
            <dt className="text-neutral-500">{ui.sources.lastError}</dt>
            <dd className="break-words text-red-700 sm:col-span-2">{source.last_error}</dd>
          </>
        )}
      </dl>

      <Can permission="sources.manage">
        <div className="mt-3 flex flex-wrap gap-2">
          {(source.type === "rss" || source.type === "youtube") && (
            <Button disabled={busy} onClick={() => run(() => api(`sources/${source.id}/test`, { method: "POST" }))}>
              {busy ? ui.sources.testing : ui.sources.test}
            </Button>
          )}
          <Button
            disabled={busy}
            onClick={() =>
              run(() => api(`sources/${source.id}`, { method: "PATCH", body: JSON.stringify({ is_active: !source.is_active }) }))
            }
          >
            {source.is_active ? ui.common.deactivate : ui.common.activate}
          </Button>
        </div>

        {source.type === "csv" && (
          <form onSubmit={upload} className="mt-3 space-y-2">
            <p className="text-xs text-neutral-500">{ui.sources.csvFormat}</p>
            <div className="flex flex-wrap items-center gap-2">
              <input name="file" type="file" accept=".csv,text/csv" required className="text-sm" />
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? ui.sources.uploading : ui.sources.upload}
              </Button>
            </div>
          </form>
        )}
      </Can>

      <ErrorText>{error}</ErrorText>
      {lastImport && <ImportResult batch={lastImport} />}
      {source.type === "csv" && <ImportHistory key={historyKey} sourceId={source.id} />}
    </article>
  );
}

function ImportResult({ batch }: { batch: ImportBatch }) {
  return (
    <div className="mt-3 rounded-md bg-neutral-50 p-3 text-sm">
      <p className="font-medium">
        {ui.sources.importResult}: {batch.filename}
      </p>
      <p>
        {ui.sources.total} {batch.total_rows} · {ui.sources.success} {batch.success_rows} · {ui.sources.failed}{" "}
        {batch.failed_rows}
      </p>
      {batch.errors.length > 0 && (
        <div className="mt-2">
          <Table head={[ui.sources.row, ui.sources.problem]}>
            {batch.errors.map((e, i) => (
              <tr key={i}>
                <Td>{e.row}</Td>
                <Td>{describeErrorCode(e.message)}</Td>
              </tr>
            ))}
          </Table>
          {batch.failed_rows > batch.errors.length && (
            <p className="mt-1 text-xs text-neutral-500">{ui.sources.errorsTruncated}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ImportHistory({ sourceId }: { sourceId: number }) {
  const [open, setOpen] = useState(false);
  const { data, error } = useApiData<{ data: ImportBatch[] }>(open ? `sources/${sourceId}/imports` : null);
  const batches = error ? [] : (data?.data ?? null);

  return (
    <details className="mt-3 text-sm" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer text-neutral-600">{ui.sources.importHistory}</summary>
      {batches === null ? (
        <p className="mt-2 text-neutral-500">{ui.loading}</p>
      ) : batches.length === 0 ? (
        <p className="mt-2 text-neutral-500">{ui.common.empty}</p>
      ) : (
        <div className="mt-2">
          <Table head={[ui.audit.time, ui.sources.file, ui.sources.total, ui.sources.success, ui.sources.failed]}>
            {batches.map((b) => (
              <tr key={b.id}>
                <Td>{formatDateTime(b.created_at)}</Td>
                <Td>{b.filename}</Td>
                <Td>{b.total_rows}</Td>
                <Td>{b.success_rows}</Td>
                <Td>{b.failed_rows}</Td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </details>
  );
}

function NewSourceForm({ onCreated }: { onCreated: () => void }) {
  const [type, setType] = useState<SourceType>("csv");
  const [pending, setPending] = useState(false);
  const [fields, setFields] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload: Record<string, unknown> = { type, name: data.get("name") };

    if (type === "rss") {
      payload.config = { url: data.get("url"), max_items: Number(data.get("max_items")) || undefined };
    } else if (type === "youtube") {
      payload.config = {
        video_ids: String(data.get("video_ids") ?? "")
          .split(/[\s,]+/)
          .filter(Boolean),
      };
    }
    if (type !== "csv") payload.interval_minutes = Number(data.get("interval_minutes"));

    setPending(true);
    setFields([]);
    setError(null);
    try {
      await api("sources", { method: "POST", body: JSON.stringify(payload) });
      form.reset();
      setType("csv");
      onCreated();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setFields(invalidFields(e.body));
      else setError(ui.common.actionError);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid max-w-xl gap-3 sm:grid-cols-2">
      <Field label={ui.sources.type}>
        <select value={type} onChange={(e) => setType(e.target.value as SourceType)} className={inputClass}>
          {CREATABLE_TYPES.map((t) => (
            <option key={t} value={t}>
              {sourceTypeLabels[t]}
            </option>
          ))}
        </select>
      </Field>
      <Field label={ui.sources.name}>
        <input name="name" required maxLength={120} className={inputClass} />
      </Field>

      {type === "rss" && (
        <>
          <Field label={ui.sources.url}>
            <input name="url" type="url" required placeholder="https://" className={inputClass} />
          </Field>
          <Field label={ui.sources.maxItems}>
            <input name="max_items" type="number" min={1} max={200} defaultValue={50} className={inputClass} />
          </Field>
        </>
      )}
      {type === "youtube" && (
        <div className="sm:col-span-2">
          <Field label={ui.sources.videoIds}>
            <textarea name="video_ids" required rows={3} className={inputClass} />
          </Field>
        </div>
      )}
      {type !== "csv" && (
        <Field label={ui.sources.interval}>
          <input name="interval_minutes" type="number" min={5} max={1440} defaultValue={15} required className={inputClass} />
        </Field>
      )}

      <div className="space-y-2 sm:col-span-2">
        <FieldErrors fields={fields} />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? ui.common.saving : ui.common.add}
        </Button>
      </div>
    </form>
  );
}
