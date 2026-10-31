"use client";

import { useState } from "react";
import { ShieldAlert, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/radar/page-header";
import { Section } from "@/components/radar/section";
import { Button } from "@/components/radar/button";
import { FilterBar, FilterSelect } from "@/components/radar/filter-bar";
import { DataTable, type DataTableColumn } from "@/components/radar/data-table";
import { Pagination } from "@/components/radar/pagination";
import { SeverityBadge } from "@/components/radar/severity-badge";
import { StatusChip } from "@/components/radar/status-chip";
import { Waktu } from "@/components/radar/waktu";
import { alertKindLabels, alertStatusLabels, severityLabels, ui } from "@/lib/labels";
import { useApiData } from "@/lib/use-api-data";
import type { AlertStatus, Severity } from "@/components/radar/types";

type AlertItem = {
  id: number;
  kind: keyof typeof alertKindLabels;
  status: AlertStatus;
  score: number;
  severity: Severity;
  topic: { id: number; name: string } | null;
  subject_account: { id: number; handle: string } | null;
  detected_at: string;
};

type AlertResponse = {
  data: AlertItem[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};

type Filters = {
  status: string;
  severity: string;
  kind: string;
};

const EMPTY_FILTERS: Filters = { status: "", severity: "", kind: "" };

const STATUS_OPTIONS = Object.entries(alertStatusLabels).map(([value, label]) => ({
  value,
  label,
}));

const SEVERITY_OPTIONS = Object.entries(severityLabels).map(([value, label]) => ({
  value,
  label,
}));

const KIND_OPTIONS = Object.entries(alertKindLabels).map(([value, label]) => ({
  value,
  label,
}));

export function AlertList() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const query = new URLSearchParams({ page: String(page) });
  if (filters.status) query.set("status", filters.status);
  if (filters.severity) query.set("severity", filters.severity);
  if (filters.kind) query.set("kind", filters.kind);

  const { data: result, error, reload } = useApiData<AlertResponse>(`alerts?${query}`);

  function updateFilter(key: keyof Filters, value: string) {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetFilters() {
    setPage(1);
    setFilters(EMPTY_FILTERS);
  }

  const hasActiveFilters = Boolean(filters.status || filters.severity || filters.kind);

  const columns: DataTableColumn<AlertItem>[] = [
    {
      id: "id",
      header: ui.alerts.id,
      cell: (row) => `#${row.id}`,
      mono: true,
      width: "w-20",
    },
    {
      id: "target",
      header: ui.alerts.topicOrAccount,
      cell: (row) => (
        <span className="font-medium text-ink">
          {row.topic?.name ?? (row.subject_account?.handle ? `@${row.subject_account.handle}` : ui.common.none)}
        </span>
      ),
    },
    {
      id: "kind",
      header: ui.alerts.kind,
      cell: (row) => (
        <span className="text-table text-ink-muted">
          {alertKindLabels[row.kind] ?? row.kind}
        </span>
      ),
    },
    {
      id: "score",
      header: ui.alerts.score,
      cell: (row) => (
        <span className="font-mono text-table font-semibold tabular-nums text-ink">
          {row.score}
        </span>
      ),
      align: "right",
      width: "w-20",
    },
    {
      id: "severity",
      header: ui.alerts.severity,
      cell: (row) => <SeverityBadge severity={row.severity} size="sm" />,
      width: "w-32",
    },
    {
      id: "status",
      header: ui.alerts.status,
      cell: (row) => <StatusChip status={row.status} />,
      width: "w-32",
    },
    {
      id: "detected_at",
      header: ui.alerts.detectedAt,
      cell: (row) => <Waktu value={row.detected_at} />,
      width: "w-44",
    },
  ];

  return (
    <div>
      <PageHeader
        title={ui.alerts.title}
        subtitle="Daftar deteksi anomali volume, koordinasi akun, dan potensi peniruan identitas yang terdeteksi sistem."
        icon={<ShieldAlert className="size-6 text-brand" aria-hidden="true" />}
      />

      {/* Filter Bar */}
      <div className="mb-4 rounded-control border border-line bg-panel p-4">
        <FilterBar label="Filter Peringatan">
          <FilterSelect
            label={ui.alerts.filterStatus}
            name="status"
            value={filters.status}
            options={STATUS_OPTIONS}
            onChange={(val) => updateFilter("status", val)}
            allLabel={ui.alerts.allStatus}
          />
          <FilterSelect
            label={ui.alerts.filterSeverity}
            name="severity"
            value={filters.severity}
            options={SEVERITY_OPTIONS}
            onChange={(val) => updateFilter("severity", val)}
            allLabel={ui.alerts.allSeverity}
          />
          <FilterSelect
            label={ui.alerts.filterKind}
            name="kind"
            value={filters.kind}
            options={KIND_OPTIONS}
            onChange={(val) => updateFilter("kind", val)}
            allLabel={ui.alerts.allKind}
          />
          {hasActiveFilters && (
            <div className="flex self-end pb-0.5">
              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-caption text-ink-muted">
                <RotateCcw className="size-3.5" aria-hidden="true" />
                <span>Reset</span>
              </Button>
            </div>
          )}
        </FilterBar>
      </div>

      <Section flush title="Daftar Kasus Peringatan">
        <DataTable
          columns={columns}
          rows={result?.data ?? []}
          getRowKey={(row) => row.id}
          rowHref={(row) => `/alerts/${row.id}`}
          rowSeverity={(row) => row.severity}
          loading={result === null}
          error={error ? { title: ui.common.loadError, onRetry: reload } : null}
          caption="Tabel daftar peringatan dini"
          framed={false}
        />
        {result && result.meta.total > 0 && (
          <div className="border-t border-line px-5 py-3">
            <Pagination
              page={result.meta.current_page}
              perPage={result.meta.per_page}
              total={result.meta.total}
              onPageChange={setPage}
            />
          </div>
        )}
      </Section>
    </div>
  );
}
