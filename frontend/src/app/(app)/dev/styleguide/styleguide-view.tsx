"use client";

import { useState } from "react";
import { Button } from "@/components/radar/button";
import { ConfirmDialog } from "@/components/radar/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/radar/data-table";
import { SignalChart } from "@/components/charts/signal-chart";
import { ClearFilters, FilterBar, FilterSelect } from "@/components/radar/filter-bar";
import { controlClass, Field } from "@/components/radar/form";
import { PageHeader } from "@/components/radar/page-header";
import { Pagination } from "@/components/radar/pagination";
import { Section } from "@/components/radar/section";
import { SimBadge, SimulationBanner } from "@/components/radar/simulation";
import { SkeletonCard, SkeletonChart, SkeletonRows } from "@/components/radar/skeleton";
import { Stat } from "@/components/radar/stat";
import { EmptyState, ErrorState, NotAvailable, NotImplemented } from "@/components/radar/states";
import { SeverityBadge } from "@/components/radar/severity-badge";
import { StatusChip } from "@/components/radar/status-chip";
import { Waktu } from "@/components/radar/waktu";
import { Forbidden } from "@/components/forbidden";
import { ALL_SEVERITIES, ALL_STATUSES, SAMPLE_ROWS, SAMPLE_TIME, type SampleRow } from "@/fixtures/common";
import { SIGNAL_BASELINE, SIGNAL_MARKERS, SIGNAL_SERIES, SIGNAL_THRESHOLD, SIGNAL_WINDOW } from "@/fixtures/signal";
import { formatInteger } from "@/lib/format";
import { severityLabels, alertStatusLabels, ui } from "@/lib/labels";

const copy = ui.styleguide;

const SWATCHES = [
  ["bg-paper", "paper"],
  ["bg-panel", "panel"],
  ["bg-line", "line"],
  ["bg-line-input", "line-input"],
  ["bg-hover", "hover"],
  ["bg-ink", "ink"],
  ["bg-ink-muted", "ink-muted"],
  ["bg-brand", "brand"],
  ["bg-brand-tint", "brand-tint"],
  ["bg-sidebar", "sidebar"],
  ["bg-sev-high", "sev-high"],
  ["bg-sev-medium", "sev-medium"],
  ["bg-sev-low", "sev-low"],
  ["bg-sim", "sim"],
  ["bg-viz-1", "viz-1"],
  ["bg-viz-2", "viz-2"],
  ["bg-viz-3", "viz-3"],
  ["bg-viz-4", "viz-4"],
] as const;

const COLUMNS: DataTableColumn<SampleRow>[] = [
  { id: "title", header: copy.columns.title, cell: (r) => r.title },
  { id: "severity", header: copy.columns.severity, cell: (r) => <SeverityBadge severity={r.severity} size="sm" /> },
  { id: "status", header: copy.columns.status, cell: (r) => <StatusChip status={r.status} /> },
  { id: "score", header: copy.columns.score, cell: (r) => r.score, align: "right", mono: true },
  {
    id: "detected",
    header: copy.columns.detected,
    cell: (r) => (
      <span className="flex items-center gap-2">
        <Waktu value={r.detectedAt} />
        {r.simulated && <SimBadge />}
      </span>
    ),
  },
];

/** Presentasi murni: dipakai /dev/styleguide dan bisa dipakai tes. Semua data dari fixture. */
export function StyleguideView() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  return (
    <>
      <PageHeader title={copy.title} subtitle={copy.subtitle} />

      <Section title={copy.palette}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {SWATCHES.map(([cls, name]) => (
            <li key={name} className="text-caption text-ink-muted">
              <div className={`h-10 rounded-control border border-line ${cls}`} />
              <span className="mt-1 block font-mono">{name}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={copy.type}>
        <p className="font-serif text-title font-semibold">{copy.sampleHeading}</p>
        <p className="mt-2 text-sm">{copy.sampleBody}</p>
        <p className="mt-2 font-mono text-table">{copy.sampleMono}</p>
        <p className="mt-2 text-metric font-semibold tabular-nums">{formatInteger(12345)}</p>
      </Section>

      <Section title={copy.badges}>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {ALL_SEVERITIES.map((severity) => (
            <SeverityBadge key={severity} severity={severity} />
          ))}
          <SeverityBadge severity="high" size="sm" />
          <SeverityBadge severity="high" size="lg" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {ALL_STATUSES.map((status) => (
            <StatusChip key={status} status={status} />
          ))}
        </div>
      </Section>

      <Section title={copy.time}>
        <div className="flex flex-wrap items-start gap-6">
          <Waktu value={SAMPLE_TIME} />
          <Waktu value={SAMPLE_TIME} utc="inline" />
          <Waktu value={SAMPLE_TIME} format="date" />
          <Waktu value={SAMPLE_TIME} format="time" />
          <Waktu value={null} />
        </div>
        <p className="mt-2 text-caption text-ink-muted">{copy.hoverNote}</p>
      </Section>

      <Section title={copy.table}>
        <div className="space-y-4">
          <DataTable columns={COLUMNS} rows={SAMPLE_ROWS} getRowKey={(r) => r.id} rowSeverity={(r) => r.severity} caption={copy.tableCaption} />
          <DataTable columns={COLUMNS} rows={[]} getRowKey={(r: SampleRow) => r.id} loading caption={copy.tableCaption} />
          <DataTable
            columns={COLUMNS}
            rows={[]}
            getRowKey={(r: SampleRow) => r.id}
            caption={copy.tableCaption}
            empty={<EmptyState title={copy.tableEmpty} description={copy.tableEmptyHint} loadedAt={SAMPLE_TIME} />}
          />
          <DataTable columns={COLUMNS} rows={[]} getRowKey={(r: SampleRow) => r.id} caption={copy.tableCaption} error={{ onRetry: () => undefined }} />
        </div>
      </Section>

      <Section title={copy.states}>
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyState title={copy.tableEmpty} description={copy.tableEmptyHint} />
          <ErrorState onRetry={() => undefined} />
          <NotAvailable />
          <NotImplemented />
          <Forbidden />
        </div>
      </Section>

      <Section title={copy.feedback}>
        <FilterBar label={copy.filter}>
          <FilterSelect
            label={copy.filterSeverity}
            value={severityFilter}
            onChange={setSeverityFilter}
            options={ALL_SEVERITIES.map((value) => ({ value, label: severityLabels[value] }))}
          />
          <FilterSelect
            label={copy.filterStatus}
            value={statusFilter}
            onChange={setStatusFilter}
            options={ALL_STATUSES.map((value) => ({ value, label: alertStatusLabels[value] }))}
          />
          <ClearFilters
            active={severityFilter !== "" || statusFilter !== ""}
            onClear={() => {
              setSeverityFilter("");
              setStatusFilter("");
            }}
          />
        </FilterBar>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button variant="primary">{copy.buttons.primary}</Button>
          <Button>{copy.buttons.secondary}</Button>
          <Button variant="destructive">{copy.buttons.destructive}</Button>
          <Button variant="primary" pending>
            {copy.buttons.pending}
          </Button>
          <Button disabled>{copy.buttons.disabled}</Button>
          <Button onClick={() => setConfirmOpen(true)}>{copy.confirmOpen}</Button>
        </div>
        <div className="max-w-sm">
          <Field label={copy.fieldLabel} error={copy.fieldError}>
            <input className={controlClass} aria-invalid="true" />
          </Field>
        </div>
        <ConfirmDialog
          open={confirmOpen}
          title={copy.confirmTitle}
          description={copy.confirmBody}
          confirmLabel={copy.confirmAction}
          destructive
          onConfirm={() => setConfirmOpen(false)}
          onClose={() => setConfirmOpen(false)}
        />
      </Section>

      <Section title={copy.stats}>
        <div className="mb-2 grid gap-4 sm:grid-cols-3">
          <Stat label={copy.statLabel} value={formatInteger(1284)} hint={copy.statHint} />
          <Stat label={copy.statLabel} value={formatInteger(12)} />
        </div>
        <Pagination page={page} perPage={25} total={130} onPageChange={setPage} />
      </Section>

      <Section title={copy.charts}>
        <div className="space-y-8">
          <div>
            <h3 className="mb-2 text-table font-medium text-ink-muted">{copy.chartFull}</h3>
            <SignalChart series={SIGNAL_SERIES} baseline={SIGNAL_BASELINE} threshold={SIGNAL_THRESHOLD} window={SIGNAL_WINDOW} markers={SIGNAL_MARKERS} />
          </div>
          <div>
            <h3 className="mb-2 text-table font-medium text-ink-muted">{copy.chartNoBaseline}</h3>
            <SignalChart series={SIGNAL_SERIES} />
          </div>
          <div>
            <h3 className="mb-2 text-table font-medium text-ink-muted">{copy.chartWindowOnly}</h3>
            <SignalChart series={SIGNAL_SERIES} window={SIGNAL_WINDOW} />
          </div>
          <div>
            <h3 className="mb-2 text-table font-medium text-ink-muted">{copy.chartCompact}</h3>
            <div className="max-w-sm">
              <SignalChart series={SIGNAL_SERIES} variant="compact" markers={SIGNAL_MARKERS} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <h3 className="mb-2 text-table font-medium text-ink-muted">{copy.chartEmpty}</h3>
              <SignalChart series={[]} />
            </div>
            <div>
              <h3 className="mb-2 text-table font-medium text-ink-muted">{copy.chartLoading}</h3>
              <SignalChart series={[]} loading />
            </div>
            <div>
              <h3 className="mb-2 text-table font-medium text-ink-muted">{copy.chartError}</h3>
              <SignalChart series={[]} error={{ onRetry: () => undefined }} />
            </div>
          </div>
        </div>
      </Section>

      <Section title={copy.skeletons}>
        <div className="space-y-4">
          <SkeletonRows />
          <div className="grid gap-4 sm:grid-cols-2">
            <SkeletonCard />
            <SkeletonChart />
          </div>
        </div>
      </Section>

      <Section title={copy.simulation}>
        <div className="mb-3 overflow-hidden rounded-control">
          <SimulationBanner dataClock={SAMPLE_TIME} />
        </div>
        <SimBadge />
      </Section>
    </>
  );
}
