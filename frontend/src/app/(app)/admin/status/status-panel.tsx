"use client";

import { CircleCheck, CircleDashed, TriangleAlert } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/radar/data-table";
import { PageHeader } from "@/components/radar/page-header";
import { Section } from "@/components/radar/section";
import { Stat } from "@/components/radar/stat";
import { EmptyState, ErrorState } from "@/components/radar/states";
import { Waktu } from "@/components/radar/waktu";
import { formatInteger } from "@/lib/format";
import { sourceStatusLabels, sourceTypeLabels, ui } from "@/lib/labels";
import { useApiData } from "@/lib/use-api-data";

type SourceRow = {
  id: number;
  type: keyof typeof sourceTypeLabels;
  name: string;
  is_active: boolean;
  last_status: keyof typeof sourceStatusLabels;
  last_fetched_at: string | null;
  last_error: string | null;
};

type FailureRow = { id: number; job: string | null; error: string; failed_at: string };

type Status = {
  sources: SourceRow[];
  queue: {
    pending_jobs: number;
    failed_jobs: number;
    recent_failures: FailureRow[];
  };
  counts: { raw_items: number; unprocessed_raw_items: number; posts: number; open_alerts: number };
  offline_mode: boolean;
};

/** Status sumber: ikon dan teks, tanpa warna hijau. */
function SourceState({ status }: { status: SourceRow["last_status"] }) {
  const label = sourceStatusLabels[status];
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1.5 text-ink">
        <CircleCheck aria-hidden="true" className="size-4" />
        {label}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sev-high">
        <TriangleAlert aria-hidden="true" className="size-4" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-ink-muted">
      <CircleDashed aria-hidden="true" className="size-4" />
      {label}
    </span>
  );
}

const SOURCE_COLUMNS: DataTableColumn<SourceRow>[] = [
  {
    id: "name",
    header: ui.sources.name,
    cell: (s) => (
      <>
        <span className="font-medium text-ink">{s.name}</span>
        {!s.is_active && <span className="ml-2 text-caption text-ink-muted">{ui.common.inactive}</span>}
      </>
    ),
  },
  { id: "type", header: ui.sources.type, cell: (s) => sourceTypeLabels[s.type] },
  { id: "status", header: ui.sources.status, cell: (s) => <SourceState status={s.last_status} /> },
  { id: "checked", header: ui.sources.lastChecked, cell: (s) => <Waktu value={s.last_fetched_at} /> },
  {
    id: "error",
    header: ui.sources.lastError,
    cell: (s) => <span className="break-words text-sev-high">{s.last_error ?? ui.common.none}</span>,
  },
];

const FAILURE_COLUMNS: DataTableColumn<FailureRow>[] = [
  { id: "at", header: ui.audit.time, cell: (f) => <Waktu value={f.failed_at} /> },
  { id: "job", header: ui.adminStatus.recentFailures, mono: true, cell: (f) => f.job ?? ui.common.none },
  { id: "error", header: "", cell: (f) => <span className="break-words text-sev-high">{f.error}</span> },
];

export function StatusPanel() {
  const { data, error, reload } = useApiData<{ data: Status }>("system/status");
  const status = error ? null : (data?.data ?? null);

  return (
    <div className="space-y-6">
      <PageHeader
        title={ui.adminStatus.title}
        meta={
          status && (
            <span className="inline-flex items-center gap-2 rounded-badge border border-line px-2.5 py-1 text-table text-ink">
              {ui.adminStatus.offlineMode}: {status.offline_mode ? ui.common.active : ui.common.inactive}
            </span>
          )
        }
      />

      {error ? (
        <ErrorState onRetry={reload} />
      ) : status === null ? (
        <p className="text-table text-ink-muted">{ui.loading}</p>
      ) : (
        <>
          <Section title={ui.adminStatus.counts}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label={ui.adminStatus.rawItems} value={formatInteger(status.counts.raw_items)} />
              <Stat label={ui.adminStatus.unprocessedRawItems} value={formatInteger(status.counts.unprocessed_raw_items)} />
              <Stat label={ui.adminStatus.posts} value={formatInteger(status.counts.posts)} />
              <Stat label={ui.adminStatus.openAlerts} value={formatInteger(status.counts.open_alerts)} />
            </div>
          </Section>

          <Section title={ui.adminStatus.sources} flush>
            <DataTable
              caption={ui.adminStatus.sources}
              columns={SOURCE_COLUMNS}
              rows={status.sources}
              getRowKey={(s) => s.id}
              framed={false}
              empty={<EmptyState title={ui.common.empty} />}
            />
          </Section>

          <Section title={ui.adminStatus.queue} flush={status.queue.recent_failures.length > 0}>
            <div className={status.queue.recent_failures.length > 0 ? "px-5 pb-4 pt-0" : undefined}>
              <div className="grid max-w-xl gap-4 sm:grid-cols-2">
                <Stat label={ui.adminStatus.pendingJobs} value={formatInteger(status.queue.pending_jobs)} />
                <Stat label={ui.adminStatus.failedJobs} value={formatInteger(status.queue.failed_jobs)} />
              </div>
            </div>
            {status.queue.recent_failures.length > 0 && (
              <DataTable
                caption={ui.adminStatus.recentFailures}
                columns={FAILURE_COLUMNS}
                rows={status.queue.recent_failures}
                getRowKey={(f) => f.id}
                framed={false}
              />
            )}
          </Section>
        </>
      )}
    </div>
  );
}
