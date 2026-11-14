"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, RotateCw } from "lucide-react";
import { useCan, useMe } from "@/components/permissions-provider";
import { PageHeader } from "@/components/radar/page-header";
import { Section } from "@/components/radar/section";
import { Button } from "@/components/radar/button";
import { SeverityBadge } from "@/components/radar/severity-badge";
import { StatusChip } from "@/components/radar/status-chip";
import { Waktu } from "@/components/radar/waktu";
import { DataTable, type DataTableColumn } from "@/components/radar/data-table";
import { SimBadge } from "@/components/radar/simulation";
import { EmptyState, ErrorState } from "@/components/radar/states";
import { SkeletonCard } from "@/components/radar/skeleton";
import { cn } from "@/lib/cn";
import { formatInteger } from "@/lib/format";
import { formatWib } from "@/lib/format/time";
import { alertKindLabels, ui } from "@/lib/labels";
import {
  calculatePeakHour,
  calculateTotalVolume,
  type DashboardSummary,
  type RankedIssue,
} from "@/lib/dashboard";
import { useApiData } from "@/lib/use-api-data";
import { DashboardChart } from "./dashboard-chart";

const KPI_CARD = "rounded-control border border-line bg-panel p-5";

function subjectOf(issue: RankedIssue): string {
  if (issue.topic) return issue.topic.name;
  if (issue.subject_account) return `@${issue.subject_account.handle.replace(/^@/, "")}`;
  return ui.common.none;
}

export function DashboardPanel() {
  const me = useMe();
  const can = useCan();
  const isLeader = me.role.slug === "leader";
  const [isReloading, setIsReloading] = useState(false);

  const {
    data: summaryRes,
    error: summaryError,
    reload: reloadSummary,
  } = useApiData<{ data: DashboardSummary }>("dashboard/summary");

  const {
    data: issuesRes,
    error: issuesError,
    reload: reloadIssues,
  } = useApiData<{ data: RankedIssue[] }>("dashboard/issues");

  const summary = summaryRes?.data ?? null;
  const issues = issuesRes?.data ?? null;
  const hasSimulatedData = summary?.data_notice?.has_simulated_data ?? false;
  const trendPoints = summary?.trend_24h ?? [];
  const totalVolume = calculateTotalVolume(trendPoints);
  const peakHour = calculatePeakHour(trendPoints);

  // Isu yang menunggu tindakan peran ini: analis melihat yang baru, pimpinan yang dieskalasi.
  const waitingStatus = can("alerts.triage") ? "new" : can("alerts.decide") ? "escalated" : null;
  const waiting = waitingStatus && issues ? issues.filter((i) => i.status === waitingStatus) : null;

  async function reloadAll() {
    setIsReloading(true);
    try {
      await Promise.all([reloadSummary(), reloadIssues()]);
    } finally {
      setIsReloading(false);
    }
  }

  const issueColumns: DataTableColumn<RankedIssue>[] = [
    {
      id: "topic",
      header: ui.dashboard.issues.table.topic,
      cell: (row) => <span className="font-medium text-ink">{subjectOf(row)}</span>,
    },
    {
      id: "kind",
      header: ui.dashboard.issues.table.kind,
      cell: (row) => alertKindLabels[row.kind] ?? row.kind,
    },
    {
      id: "score",
      header: ui.dashboard.issues.table.score,
      mono: true,
      cell: (row) => <span className="font-semibold tabular-nums text-ink">{row.score}</span>,
    },
    {
      id: "severity",
      header: ui.dashboard.issues.table.severity,
      cell: (row) => <SeverityBadge severity={row.severity} size="sm" />,
    },
    {
      id: "status",
      header: ui.dashboard.issues.table.status,
      cell: (row) => <StatusChip status={row.status} />,
    },
    {
      id: "detectedAt",
      header: ui.dashboard.issues.table.detectedAt,
      cell: (row) => <Waktu value={row.detected_at} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={ui.dashboard.title}
        subtitle={ui.dashboard.subtitle}
        actions={
          <div className="flex items-center gap-3">
            {hasSimulatedData && <SimBadge />}
            <Button variant="secondary" onClick={reloadAll} pending={isReloading} className="gap-2">
              <RotateCw className={cn("size-3.5", isReloading && "animate-spin")} />
              <span>Segarkan</span>
            </Button>
          </div>
        }
      />

      {(summaryError || issuesError) && (
        <ErrorState
          title={ui.common.loadError}
          description="Gagal memuat ringkasan atau isu dasbor. Periksa koneksi ke server."
          onRetry={reloadAll}
        />
      )}

      <div className="grid gap-6 sm:grid-cols-3">
        {summary === null ? (
          <SkeletonCard />
        ) : (
          <div className={KPI_CARD}>
            <p className="text-table text-ink-muted">{ui.dashboard.kpi.activeIssues}</p>
            <p className="mt-2 font-mono text-metric font-semibold tabular-nums text-ink">{summary.active_issues}</p>
            <p className="mt-2 text-caption text-ink-muted">{ui.dashboard.kpi.activeIssuesDesc}</p>
          </div>
        )}

        {summary === null ? (
          <SkeletonCard />
        ) : (
          <div className={KPI_CARD}>
            <p className="text-table text-ink-muted">{ui.dashboard.kpi.highestSeverity}</p>
            <div className="mt-3 flex min-h-[36px] items-center">
              {summary.highest_severity ? (
                <SeverityBadge severity={summary.highest_severity} size="lg" />
              ) : (
                <span className="font-mono text-metric font-semibold text-ink-muted">—</span>
              )}
            </div>
            <p className="mt-2 text-caption text-ink-muted">{ui.dashboard.kpi.highestSeverityDesc}</p>
          </div>
        )}

        {summary === null ? (
          <SkeletonCard />
        ) : (
          <div className={KPI_CARD}>
            <p className="text-table text-ink-muted">{ui.dashboard.kpi.awaitingDecision}</p>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="font-mono text-metric font-semibold tabular-nums text-ink">{summary.awaiting_decision}</span>
              {isLeader && summary.awaiting_decision > 0 && (
                <Link
                  href="/alerts?status=escalated"
                  className="inline-flex items-center gap-1 text-caption font-medium text-brand hover:underline"
                >
                  <span>Tinjau sekarang</span>
                  <ArrowRight className="size-3" />
                </Link>
              )}
            </div>
            <p className="mt-2 text-caption text-ink-muted">{ui.dashboard.kpi.awaitingDecisionDesc}</p>
          </div>
        )}
      </div>

      {waitingStatus && (
        <Section title={ui.dashboard.priority.title} description={ui.dashboard.priority.subtitle}>
          {waiting === null ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <SkeletonCard />
            </div>
          ) : waiting.length === 0 ? (
            <EmptyState title={ui.dashboard.priority.empty} />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {waiting.slice(0, 3).map((issue) => (
                <li key={issue.id}>
                  <Link
                    href={`/alerts/${issue.id}`}
                    className={cn(
                      "flex h-full flex-col gap-3 rounded-control border border-line bg-panel p-4 transition-colors hover:bg-hover",
                      issue.severity === "high" && "border-sev-high shadow-glow-alert",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <SeverityBadge severity={issue.severity} size="sm" />
                      <span className="font-mono text-table font-semibold tabular-nums text-ink">{issue.score}</span>
                    </div>
                    <p className="text-section font-semibold text-ink">{subjectOf(issue)}</p>
                    <div className="mt-auto flex items-center justify-between text-caption text-ink-muted">
                      <span>{alertKindLabels[issue.kind] ?? issue.kind}</span>
                      <span className="inline-flex items-center gap-1 text-brand">
                        {ui.dashboard.priority.open}
                        <ArrowRight className="size-3" />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <Section
        title={ui.dashboard.trend.title}
        description={ui.dashboard.trend.subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-3 text-caption text-ink-muted">
            <span className="inline-flex items-center gap-1.5 rounded-badge border border-line bg-paper px-2.5 py-1">
              <span>{ui.dashboard.trend.totalPosts}:</span>
              <strong className="font-mono font-semibold text-ink">{formatInteger(totalVolume)}</strong>
            </span>
            {peakHour && (
              <span className="inline-flex items-center gap-1.5 rounded-badge border border-line bg-paper px-2.5 py-1">
                <span>{ui.dashboard.trend.peakHour}:</span>
                <strong className="font-mono font-semibold text-ink">
                  {formatWib(peakHour.hour, "time")} ({formatInteger(peakHour.volume)} posting/jam)
                </strong>
              </span>
            )}
          </div>
        }
      >
        <DashboardChart data={trendPoints} />
      </Section>

      <Section
        title={ui.dashboard.issues.title}
        description={ui.dashboard.issues.subtitle}
        actions={
          <Link href="/alerts" className="inline-flex items-center gap-1 text-table font-medium text-brand hover:underline">
            <span>{ui.dashboard.issues.viewAllAlerts}</span>
            <ArrowRight className="size-4" />
          </Link>
        }
      >
        <DataTable
          columns={issueColumns}
          rows={issues ?? []}
          getRowKey={(row) => row.id}
          rowHref={(row) => `/alerts/${row.id}`}
          rowSeverity={(row) => row.severity}
          loading={issues === null}
          empty={<EmptyState title={ui.dashboard.issues.empty} />}
          caption={ui.dashboard.issues.title}
        />
      </Section>
    </div>
  );
}
