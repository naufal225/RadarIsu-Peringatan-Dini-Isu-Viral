"use client";

import Link from "next/link";
import { useCan, useMe } from "@/components/permissions-provider";
import { Button, ErrorText, PageTitle, StatusBadge, Table, Td } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { alertKindLabels, alertStatusLabels, severityLabels, ui } from "@/lib/labels";
import {
  calculatePeakHour,
  calculateTotalVolume,
  severityTone,
  type DashboardSummary,
  type RankedIssue,
} from "@/lib/dashboard";
import { useApiData } from "@/lib/use-api-data";
import { DashboardChart } from "./dashboard-chart";

const peakTimeFormat = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export function DashboardPanel() {
  const me = useMe();
  const can = useCan();
  const isLeader = me.role.slug === "leader";

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

  function reloadAll() {
    reloadSummary();
    reloadIssues();
  }

  function getStatusTone(status: keyof typeof alertStatusLabels): "error" | "warn" | "ok" | "muted" {
    if (status === "escalated") return isLeader ? "error" : "warn";
    if (status === "new") return "warn";
    if (status === "approved") return "ok";
    return "muted";
  }

  function getScoreBadgeClass(score: number): string {
    if (score >= 70) {
      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800";
    }
    if (score >= 40) {
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
    }
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <PageTitle>{ui.dashboard.title}</PageTitle>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {ui.dashboard.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasSimulatedData && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
              title="Data bersumber dari feed pengujian atau skenario replay"
            >
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              {ui.simulatedData}
            </span>
          )}
          <Button onClick={reloadAll} variant="secondary" className="cursor-pointer">
            Segarkan
          </Button>
        </div>
      </div>

      {/* Global Error Banner */}
      {(summaryError || issuesError) && (
        <ErrorText>{ui.common.loadError}</ErrorText>
      )}

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Card 1: Active Issues */}
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              {ui.dashboard.kpi.activeIssues}
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight">
              {summary ? summary.active_issues : "—"}
            </span>
            <span className="text-xs text-neutral-500">terbuka</span>
          </div>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {ui.dashboard.kpi.activeIssuesDesc}
          </p>
        </div>

        {/* Card 2: Highest Severity */}
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              {ui.dashboard.kpi.highestSeverity}
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex items-baseline">
            {summary?.highest_severity ? (
              <StatusBadge tone={severityTone(summary.highest_severity)}>
                {severityLabels[summary.highest_severity]}
              </StatusBadge>
            ) : (
              <span className="text-3xl font-bold tracking-tight text-neutral-400">—</span>
            )}
          </div>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {ui.dashboard.kpi.highestSeverityDesc}
          </p>
        </div>

        {/* Card 3: Awaiting Decision */}
        <div
          className={`rounded-lg border p-5 shadow-sm transition hover:shadow-md ${
            isLeader && (summary?.awaiting_decision ?? 0) > 0
              ? "border-amber-400 bg-amber-50/40 dark:border-amber-600 dark:bg-amber-950/20"
              : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              {ui.dashboard.kpi.awaitingDecision}
            </span>
            <span
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${
                isLeader && (summary?.awaiting_decision ?? 0) > 0
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300"
                  : "bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight">
              {summary ? summary.awaiting_decision : "—"}
            </span>
            {isLeader && (summary?.awaiting_decision ?? 0) > 0 && (
              <Link
                href="/alerts?status=escalated"
                className="text-xs font-semibold text-amber-700 hover:underline dark:text-amber-400"
              >
                Tinjau sekarang →
              </Link>
            )}
          </div>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {ui.dashboard.kpi.awaitingDecisionDesc}
          </p>
        </div>
      </div>

      {/* 24-Hour Trend Chart Card */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-100 pb-4 dark:border-neutral-800">
          <div>
            <h2 className="text-base font-semibold">{ui.dashboard.trend.title}</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {ui.dashboard.trend.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-500">{ui.dashboard.trend.totalPosts}:</span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                {totalVolume.toLocaleString("id-ID")}
              </span>
            </div>
            {peakHour && (
              <div className="flex items-center gap-1.5 border-l border-neutral-200 pl-4 dark:border-neutral-700">
                <span className="text-neutral-500">{ui.dashboard.trend.peakHour}:</span>
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  {peakTimeFormat.format(new Date(peakHour.hour))} UTC ({peakHour.volume.toLocaleString("id-ID")})
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <DashboardChart data={trendPoints} />
        </div>
      </div>

      {/* Ranked Priority Issues Table Card */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4 dark:border-neutral-800">
          <div>
            <h2 className="text-base font-semibold">{ui.dashboard.issues.title}</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {ui.dashboard.issues.subtitle}
            </p>
          </div>
          <Link
            href="/alerts"
            className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400"
          >
            {ui.dashboard.issues.viewAllAlerts} →
          </Link>
        </div>

        <div className="mt-4">
          {issues === null ? (
            <p className="py-8 text-center text-sm text-neutral-500">{ui.loading}</p>
          ) : issues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {ui.dashboard.issues.empty}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Semua isu saat ini berada dalam kondisi terkendali atau telah ditutup.
              </p>
            </div>
          ) : (
            <Table
              head={[
                ui.dashboard.issues.table.topic,
                ui.dashboard.issues.table.kind,
                ui.dashboard.issues.table.score,
                ui.dashboard.issues.table.severity,
                ui.dashboard.issues.table.status,
                ui.dashboard.issues.table.detectedAt,
                ui.dashboard.issues.table.action,
              ]}
            >
              {issues.map((issue) => (
                <tr key={issue.id} className="transition hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40">
                  <Td className="font-medium text-neutral-900 dark:text-neutral-100">
                    {issue.topic?.name ?? issue.subject_account?.handle ?? ui.common.none}
                  </Td>
                  <Td className="text-xs text-neutral-600 dark:text-neutral-400">
                    {alertKindLabels[issue.kind] ?? issue.kind}
                  </Td>
                  <Td>
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs font-semibold ${getScoreBadgeClass(
                        issue.score,
                      )}`}
                    >
                      {issue.score}
                    </span>
                  </Td>
                  <Td>
                    <StatusBadge tone={severityTone(issue.severity)}>
                      {severityLabels[issue.severity] ?? issue.severity}
                    </StatusBadge>
                  </Td>
                  <Td>
                    <StatusBadge tone={getStatusTone(issue.status)}>
                      {alertStatusLabels[issue.status] ?? issue.status}
                    </StatusBadge>
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-neutral-500">
                    {formatDateTime(issue.detected_at)}
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/alerts/${issue.id}`}
                      className="inline-flex items-center rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                    >
                      {ui.dashboard.issues.viewDetail}
                    </Link>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {ui.dashboard.quickLinks.title}
        </h3>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {can("alerts.triage") && (
            <Link
              href="/alerts?status=new"
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-medium shadow-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
            >
              {ui.dashboard.quickLinks.triageAlerts}
            </Link>
          )}

          {can("alerts.decide") && (
            <Link
              href="/alerts?status=escalated"
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-medium shadow-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
            >
              {ui.dashboard.quickLinks.reviewEscalated}
            </Link>
          )}

          {can("topics.manage") && (
            <Link
              href="/topics"
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-medium shadow-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
            >
              {ui.dashboard.quickLinks.viewTopics}
            </Link>
          )}

          {can("briefings.view") && (
            <Link
              href="/briefings"
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-medium shadow-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
            >
              {ui.dashboard.quickLinks.viewBriefings}
            </Link>
          )}

          {can("labels.manage") && (
            <Link
              href="/labeling"
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-medium shadow-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
            >
              {ui.dashboard.quickLinks.labelingQueue}
            </Link>
          )}

          {can("evaluation.view") && (
            <Link
              href="/evaluation"
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-medium shadow-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
            >
              {ui.dashboard.quickLinks.evaluation}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
