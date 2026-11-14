"use client";

import { DataTable, type DataTableColumn } from "@/components/radar/data-table";
import { ClearFilters, FilterBar, FilterSelect } from "@/components/radar/filter-bar";
import { PageHeader } from "@/components/radar/page-header";
import { Pagination } from "@/components/radar/pagination";
import { SeverityBadge } from "@/components/radar/severity-badge";
import { StatusChip } from "@/components/radar/status-chip";
import { EmptyState, ErrorState } from "@/components/radar/states";
import { Waktu } from "@/components/radar/waktu";
import { cn } from "@/lib/cn";
import { alertKindLabels, alertStatusLabels, severityLabels, ui } from "@/lib/labels";

export type AlertItem = {
  id: number;
  kind: keyof typeof alertKindLabels;
  status: keyof typeof alertStatusLabels;
  score: number;
  severity: keyof typeof severityLabels;
  topic: { id: number; name: string } | null;
  subject_account: { id: number; handle: string } | null;
  detected_at: string;
};

export type AlertPageMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export type AlertFilters = {
  status: string;
  severity: string;
  kind: string;
};

export const EMPTY_ALERT_FILTERS: AlertFilters = { status: "", severity: "", kind: "" };

export type AlertListViewProps = {
  /** null while loading. */
  items: AlertItem[] | null;
  meta: AlertPageMeta | null;
  failed: boolean;
  onRetry: () => void;
  filters: AlertFilters;
  onFiltersChange: (filters: AlertFilters) => void;
  page: number;
  onPageChange: (page: number) => void;
};

const BAR_TONE: Record<keyof typeof severityLabels, string> = {
  high: "bg-sev-high",
  medium: "bg-sev-medium",
  low: "bg-sev-low",
};

function subjectOf(item: AlertItem): string {
  if (item.topic) return item.topic.name;
  if (item.subject_account) return `@${item.subject_account.handle.replace(/^@/, "")}`;
  return ui.common.none;
}

function ScoreCell({ item }: { item: AlertItem }) {
  const width = Math.max(0, Math.min(100, item.score));
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 font-mono text-table font-semibold tabular-nums text-ink">{item.score}</span>
      <span aria-hidden="true" className="h-1.5 w-24 overflow-hidden rounded-badge bg-hover">
        <span className={cn("block h-full", BAR_TONE[item.severity])} style={{ width: `${width}%` }} />
      </span>
    </div>
  );
}

const COLUMNS: DataTableColumn<AlertItem>[] = [
  { id: "id", header: ui.alerts.id, cell: (r) => `#${r.id}`, mono: true },
  { id: "score", header: ui.alerts.score, cell: (r) => <ScoreCell item={r} /> },
  { id: "severity", header: ui.alerts.severity, cell: (r) => <SeverityBadge severity={r.severity} size="sm" /> },
  { id: "subject", header: ui.alerts.topicOrAccount, cell: (r) => <span className="font-medium text-ink">{subjectOf(r)}</span> },
  { id: "kind", header: ui.alerts.kind, cell: (r) => alertKindLabels[r.kind] ?? r.kind },
  { id: "status", header: ui.alerts.status, cell: (r) => <StatusChip status={r.status} /> },
  { id: "detected", header: ui.alerts.detectedAt, cell: (r) => <Waktu value={r.detected_at} /> },
];

/** Presentasi murni daftar alert. Diurutkan server; tabel hanya menampilkan. */
export function AlertListView({ items, meta, failed, onRetry, filters, onFiltersChange, page, onPageChange }: AlertListViewProps) {
  const set = (key: keyof AlertFilters) => (value: string) => onFiltersChange({ ...filters, [key]: value });
  const filtered = filters.status !== "" || filters.severity !== "" || filters.kind !== "";

  return (
    <div className="space-y-6">
      <PageHeader title={ui.alerts.title} subtitle={ui.alerts.listSubtitle} />

      <FilterBar label={ui.alerts.filterGroup}>
        <FilterSelect
          label={ui.alerts.filterStatus}
          name="status"
          value={filters.status}
          onChange={set("status")}
          allLabel={ui.alerts.allStatus}
          options={Object.entries(alertStatusLabels).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          label={ui.alerts.filterSeverity}
          name="severity"
          value={filters.severity}
          onChange={set("severity")}
          allLabel={ui.alerts.allSeverity}
          options={Object.entries(severityLabels).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          label={ui.alerts.filterKind}
          name="kind"
          value={filters.kind}
          onChange={set("kind")}
          allLabel={ui.alerts.allKind}
          options={Object.entries(alertKindLabels).map(([value, label]) => ({ value, label }))}
        />
        <ClearFilters active={filtered} onClear={() => onFiltersChange(EMPTY_ALERT_FILTERS)} />
      </FilterBar>

      {failed ? (
        <ErrorState onRetry={onRetry} />
      ) : (
        <>
          <DataTable
            caption={ui.alerts.title}
            columns={COLUMNS}
            rows={items ?? []}
            getRowKey={(r) => r.id}
            rowHref={(r) => `/alerts/${r.id}`}
            rowSeverity={(r) => r.severity}
            loading={items === null}
            empty={<EmptyState title={filtered ? ui.alerts.listEmptyFiltered : ui.alerts.listEmpty} />}
          />
          {meta && meta.last_page > 1 && (
            <Pagination page={page} perPage={meta.per_page} total={meta.total} onPageChange={onPageChange} />
          )}
        </>
      )}
    </div>
  );
}
