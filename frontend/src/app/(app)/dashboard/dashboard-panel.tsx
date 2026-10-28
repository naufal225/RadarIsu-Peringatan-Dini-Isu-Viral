"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CheckSquare,
  FileText,
  Hash,
  Inbox,
  Radio,
  RotateCw,
  ShieldAlert,
  Tag,
} from "lucide-react";
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
      cell: (row) => (
        <span className="font-medium text-ink">
          {row.topic?.name ?? (row.subject_account?.handle ? `@${row.subject_account.handle.replace(/^@/, "")}` : ui.common.none)}
        </span>
      ),
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
      cell: (row) => (
        <span
          className={cn(
            "inline-flex items-center rounded-badge border px-2 py-0.5 font-mono text-table font-semibold tabular-nums",
            row.score >= 70
              ? "border-sev-high bg-sev-high-bg text-sev-high"
              : row.score >= 40
              ? "border-sev-medium bg-sev-medium-bg text-sev-medium"
              : "border-sev-low bg-sev-low-bg text-sev-low",
          )}
        >
          {row.score}
        </span>
      ),
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
    {
      id: "action",
      header: ui.dashboard.issues.table.action,
      align: "right",
      cell: (row) => (
        <Link
          href={`/alerts/${row.id}`}
          className="inline-flex h-7 items-center justify-center rounded-control border border-line-input bg-panel px-2.5 text-caption font-medium text-ink transition-colors hover:bg-hover"
        >
          {ui.dashboard.issues.viewDetail}
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={ui.dashboard.title}
        subtitle={ui.dashboard.subtitle}
        actions={
          <div className="flex items-center gap-3">
            {hasSimulatedData && <SimBadge />}
            <Button
              variant="secondary"
              onClick={reloadAll}
              pending={isReloading}
              className="gap-2"
            >
              <RotateCw className={cn("size-3.5", isReloading && "animate-spin")} />
              <span>Segarkan</span>
            </Button>
          </div>
        }
      />

      {/* Global Error Banner */}
      {(summaryError || issuesError) && (
        <ErrorState
          title={ui.common.loadError}
          description="Gagal memuat ringkasan atau isu dasbor. Periksa koneksi ke server."
          onRetry={reloadAll}
        />
      )}

      {/* KPI Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-3">
        {/* Card 1: Active Issues */}
        {summary === null ? (
          <SkeletonCard />
        ) : (
          <div className="rounded-control border border-line bg-panel p-5 transition-colors">
            <div className="flex items-center justify-between text-table text-ink-muted">
              <span>{ui.dashboard.kpi.activeIssues}</span>
              <Radio className="size-4 text-brand" aria-hidden="true" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-metric font-semibold tabular-nums text-ink">
                {summary.active_issues}
              </span>
              <span className="text-caption text-ink-muted">terbuka</span>
            </div>
            <p className="mt-2 text-caption text-ink-muted">
              {ui.dashboard.kpi.activeIssuesDesc}
            </p>
          </div>
        )}

        {/* Card 2: Highest Severity */}
        {summary === null ? (
          <SkeletonCard />
        ) : (
          <div className="rounded-control border border-line bg-panel p-5 transition-colors">
            <div className="flex items-center justify-between text-table text-ink-muted">
              <span>{ui.dashboard.kpi.highestSeverity}</span>
              <ShieldAlert className="size-4 text-brand" aria-hidden="true" />
            </div>
            <div className="mt-2 flex min-h-[36px] items-center">
              {summary.highest_severity ? (
                <SeverityBadge severity={summary.highest_severity} size="md" />
              ) : (
                <span className="text-metric font-semibold text-ink-muted">—</span>
              )}
            </div>
            <p className="mt-2 text-caption text-ink-muted">
              {ui.dashboard.kpi.highestSeverityDesc}
            </p>
          </div>
        )}

        {/* Card 3: Awaiting Decision */}
        {summary === null ? (
          <SkeletonCard />
        ) : (
          <div
            className={cn(
              "rounded-control border bg-panel p-5 transition-colors",
              isLeader && summary.awaiting_decision > 0
                ? "border-brand-tint bg-brand-tint/20 ring-1 ring-brand/20"
                : "border-line",
            )}
          >
            <div className="flex items-center justify-between text-table text-ink-muted">
              <span>{ui.dashboard.kpi.awaitingDecision}</span>
              <CheckCircle2 className="size-4 text-brand" aria-hidden="true" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-metric font-semibold tabular-nums text-ink">
                {summary.awaiting_decision}
              </span>
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
            <p className="mt-2 text-caption text-ink-muted">
              {ui.dashboard.kpi.awaitingDecisionDesc}
            </p>
          </div>
        )}
      </div>

      {/* 24-Hour Trend Section */}
      <Section
        title={ui.dashboard.trend.title}
        description={ui.dashboard.trend.subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-3 text-caption text-ink-muted">
            <span className="inline-flex items-center gap-1.5 rounded-badge border border-line bg-paper px-2.5 py-1">
              <span>{ui.dashboard.trend.totalPosts}:</span>
              <strong className="font-mono font-semibold text-ink">
                {formatInteger(totalVolume)}
              </strong>
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

      {/* Ranked Priority Issues Table Section */}
      <Section
        title={ui.dashboard.issues.title}
        description={ui.dashboard.issues.subtitle}
        actions={
          <Link
            href="/alerts"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
          >
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
          empty={
            <EmptyState
              title={ui.dashboard.issues.empty}
              description="Semua isu saat ini berada dalam kondisi terkendali atau telah ditutup."
            />
          }
          caption={ui.dashboard.issues.title}
        />
      </Section>

      {/* Quick Action Shortcuts */}
      <div className="rounded-control border border-line bg-panel p-5">
        <div>
          <h3 className="text-section font-semibold text-ink">{ui.dashboard.quickLinks.title}</h3>
          <p className="mt-0.5 text-sm text-ink-muted">
            Pintasan akses cepat ke modul dan alur kerja utama sistem.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {can("alerts.triage") && (
            <Link
              href="/alerts?status=new"
              className="inline-flex items-center gap-2 rounded-control border border-line bg-panel px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-hover"
            >
              <Inbox className="size-4 text-brand" />
              <span>{ui.dashboard.quickLinks.triageAlerts}</span>
            </Link>
          )}

          {can("alerts.decide") && (
            <Link
              href="/alerts?status=escalated"
              className="inline-flex items-center gap-2 rounded-control border border-line bg-panel px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-hover"
            >
              <ArrowUpRight className="size-4 text-brand" />
              <span>{ui.dashboard.quickLinks.reviewEscalated}</span>
            </Link>
          )}

          {can("topics.manage") && (
            <Link
              href="/topics"
              className="inline-flex items-center gap-2 rounded-control border border-line bg-panel px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-hover"
            >
              <Hash className="size-4 text-brand" />
              <span>{ui.dashboard.quickLinks.viewTopics}</span>
            </Link>
          )}

          {can("briefings.view") && (
            <Link
              href="/briefings"
              className="inline-flex items-center gap-2 rounded-control border border-line bg-panel px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-hover"
            >
              <FileText className="size-4 text-brand" />
              <span>{ui.dashboard.quickLinks.viewBriefings}</span>
            </Link>
          )}

          {can("labels.manage") && (
            <Link
              href="/labeling"
              className="inline-flex items-center gap-2 rounded-control border border-line bg-panel px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-hover"
            >
              <Tag className="size-4 text-brand" />
              <span>{ui.dashboard.quickLinks.labelingQueue}</span>
            </Link>
          )}

          {can("evaluation.view") && (
            <Link
              href="/evaluation"
              className="inline-flex items-center gap-2 rounded-control border border-line bg-panel px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-hover"
            >
              <CheckSquare className="size-4 text-brand" />
              <span>{ui.dashboard.quickLinks.evaluation}</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

