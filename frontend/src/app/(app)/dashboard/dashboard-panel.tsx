"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CheckSquare,
  FileText,
  Flame,
  Hash,
  Inbox,
  Radio,
  RotateCw,
  ShieldAlert,
  Sparkles,
  Tag,
} from "lucide-react";
import { useCan, useMe } from "@/components/permissions-provider";
import { SeverityBadge } from "@/components/radar/severity-badge";
import { StatusChip } from "@/components/radar/status-chip";
import { Waktu } from "@/components/radar/waktu";
import { DataTable, type DataTableColumn } from "@/components/radar/data-table";
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

/** Grafik gelombang sparkline modern dengan area gradient. */
function WaveSparkline({ color = "#2563eb", id = "sparkline-blue" }: { color?: string; id?: string }) {
  return (
    <div className="h-14 w-full overflow-hidden my-1">
      <svg viewBox="0 0 300 70" preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path
          d="M 0,50 C 35,42 65,60 95,25 C 130,-2 160,48 195,18 C 230,-8 265,32 300,12 L 300,70 L 0,70 Z"
          fill={`url(#${id})`}
        />
        <path
          d="M 0,50 C 35,42 65,60 95,25 C 130,-2 160,48 195,18 C 230,-8 265,32 300,12"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
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
        <div className="flex items-center gap-3 py-1.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold border border-blue-100">
            <Radio className="size-4" />
          </div>
          <div className="min-w-0">
            <span className="block font-bold text-slate-800 truncate">
              {row.topic?.name ?? (row.subject_account?.handle ? `@${row.subject_account.handle.replace(/^@/, "")}` : ui.common.none)}
            </span>
            <span className="block text-[11px] text-slate-400">Kasus ID #{row.id}</span>
          </div>
        </div>
      ),
    },
    {
      id: "kind",
      header: ui.dashboard.issues.table.kind,
      cell: (row) => (
        <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200/80 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
          {alertKindLabels[row.kind] ?? row.kind}
        </span>
      ),
    },
    {
      id: "score",
      header: ui.dashboard.issues.table.score,
      mono: true,
      cell: (row) => (
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-black tabular-nums shadow-sm",
            row.score >= 70
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : row.score >= 40
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-slate-200 bg-slate-50 text-slate-700",
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
          className="inline-flex h-8 items-center justify-center rounded-lg bg-blue-600 px-3 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95"
        >
          <span>{ui.dashboard.issues.viewDetail}</span>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Able Pro Hero Header Banner */}
      <div className="hero-banner relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 size-60 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute right-40 -bottom-12 size-48 rounded-full bg-white/5 blur-xl" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-100 uppercase tracking-wider">
              <span>Dasbor Analitik</span>
              <span>/</span>
              <span>Pemantauan Situasi Siber</span>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>{ui.dashboard.title}</span>
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold text-white">Live</span>
            </h1>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm text-blue-100">
              Analisis situasi opini, anomali lonjakan, jejaring akun terkoordinasi, dan peniruan identitas secara real-time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {hasSimulatedData && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white border border-white/20 backdrop-blur-md">
                <Radio className="size-3.5 animate-pulse" />
                <span>Simulasi</span>
              </span>
            )}
            <button
              type="button"
              onClick={reloadAll}
              disabled={isReloading}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs sm:text-sm font-bold text-blue-600 shadow-md transition-all hover:bg-blue-50 active:scale-95 disabled:opacity-50"
            >
              <RotateCw className={cn("size-3.5", isReloading && "animate-spin")} />
              <span>Segarkan Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {(summaryError || issuesError) && (
        <ErrorState
          title={ui.common.loadError}
          description="Gagal memuat ringkasan atau isu dasbor. Periksa koneksi ke server."
          onRetry={reloadAll}
        />
      )}

      {/* Top 4 KPI Metrics Row (Able Pro Style) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Support Requests (Isu Aktif) */}
        {summary === null ? (
          <SkeletonCard />
        ) : (
          <div className="card-modern p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {ui.dashboard.kpi.activeIssues}
                </span>
                <div className="flex size-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Radio className="size-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black tracking-tight text-slate-800">
                  {summary.active_issues}
                </span>
                <span className="text-xs font-bold text-blue-600">kasus aktif</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                {ui.dashboard.kpi.activeIssuesDesc}
              </p>
            </div>

            <WaveSparkline color="#2563eb" id="sparkline-issues" />

            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-50 border border-slate-100 p-2 text-center text-xs">
              <div>
                <span className="block font-black text-slate-800">{summary.active_issues}</span>
                <span className="text-[10px] font-bold text-slate-400">Baru</span>
              </div>
              <div>
                <span className="block font-black text-amber-600">{summary.awaiting_decision}</span>
                <span className="text-[10px] font-bold text-slate-400">Eskalasi</span>
              </div>
              <div>
                <span className="block font-black text-emerald-600">Stabil</span>
                <span className="text-[10px] font-bold text-slate-400">Radar</span>
              </div>
            </div>
          </div>
        )}

        {/* Card 2: 24h Volume Waves (Volume Sinyal 24 Jam) */}
        {summary === null ? (
          <SkeletonCard />
        ) : (
          <div className="card-modern p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {ui.dashboard.trend.totalPosts} (24 Jam)
                </span>
                <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Flame className="size-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black tracking-tight text-slate-800">
                  {formatInteger(totalVolume)}
                </span>
                <span className="text-xs font-bold text-emerald-600">postingan</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                Volume sinyal terdeteksi di radar
              </p>
            </div>

            <WaveSparkline color="#10b981" id="sparkline-volume" />

            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-50 border border-slate-100 p-2 text-center text-xs">
              <div>
                <span className="block font-black text-slate-800">
                  {peakHour ? formatWib(peakHour.hour, "time") : "—"}
                </span>
                <span className="text-[10px] font-bold text-slate-400">Puncak</span>
              </div>
              <div>
                <span className="block font-black text-slate-800">
                  {peakHour ? formatInteger(peakHour.volume) : "0"}
                </span>
                <span className="text-[10px] font-bold text-slate-400">Maks/Jam</span>
              </div>
              <div>
                <span className="block font-black text-blue-600">Live</span>
                <span className="text-[10px] font-bold text-slate-400">Stream</span>
              </div>
            </div>
          </div>
        )}

        {/* Card 3: Keparahan Tertinggi (Mini Accent Card) */}
        {summary === null ? (
          <SkeletonCard />
        ) : (
          <div className="card-modern p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {ui.dashboard.kpi.highestSeverity}
                </span>
                <div className="flex size-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <ShieldAlert className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                {summary.highest_severity ? (
                  <SeverityBadge severity={summary.highest_severity} size="md" />
                ) : (
                  <span className="text-2xl font-black text-slate-400">—</span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {ui.dashboard.kpi.highestSeverityDesc}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">SLA Tindakan</span>
              <span className="font-bold text-slate-700">
                {summary.highest_severity === "high" ? "Maksimal 30 Menit" : "Standar 2 Jam"}
              </span>
            </div>
          </div>
        )}

        {/* Card 4: Menunggu Keputusan (Mini Accent Card) */}
        {summary === null ? (
          <SkeletonCard />
        ) : (
          <div
            className={cn(
              "card-modern p-5 flex flex-col justify-between",
              isLeader && summary.awaiting_decision > 0 && "border-blue-200 bg-blue-50/20",
            )}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {ui.dashboard.kpi.awaitingDecision}
                </span>
                <div className="flex size-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <CheckCircle2 className="size-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black tracking-tight text-slate-800">
                  {summary.awaiting_decision}
                </span>
                <span className="text-xs font-bold text-amber-600">eskalasi</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {ui.dashboard.kpi.awaitingDecisionDesc}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Status Pimpinan</span>
              {isLeader && summary.awaiting_decision > 0 ? (
                <Link
                  href="/alerts?status=escalated"
                  className="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800"
                >
                  <span>Tinjau</span>
                  <ArrowRight className="size-3" />
                </Link>
              ) : (
                <span className="font-bold text-emerald-600">Terselesaikan</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Middle Grid: Projects Table (7 cols) + Latest Updates Timeline (5 cols) ala Able Pro */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column (7 cols): Projects Table Card */}
        <div className="lg:col-span-7">
          <div className="card-modern overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-800 tracking-tight">
                  {ui.dashboard.issues.title}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {ui.dashboard.issues.subtitle}
                </p>
              </div>
              <Link
                href="/alerts"
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
              >
                <span>{ui.dashboard.issues.viewAllAlerts}</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            <DataTable
              framed={false}
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
          </div>
        </div>

        {/* Right Column (5 cols): Latest Updates Timeline ala Able Pro */}
        <div className="lg:col-span-5">
          <div className="card-modern p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h2 className="text-base font-black text-slate-800 tracking-tight">
                  Pembaruan & Linimasa Terkini
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Aktivitas deteksi anomali & respon operasional
                </p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                Realtime
              </span>
            </div>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {/* Event 1 */}
              <div className="relative">
                <div className="absolute -left-[27px] top-0 flex size-5 items-center justify-center rounded-full bg-blue-600 ring-4 ring-white text-white">
                  <div className="size-1.5 rounded-full bg-white" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Eskalasi Alert Narasi</span>
                    <span className="text-[10px] font-semibold text-slate-400">Baru saja</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Lonjakan volume narasi terdeteksi melebihi ambang batas risiko 70%.
                  </p>
                </div>
              </div>

              {/* Event 2 */}
              <div className="relative">
                <div className="absolute -left-[27px] top-0 flex size-5 items-center justify-center rounded-full bg-amber-500 ring-4 ring-white text-white">
                  <div className="size-1.5 rounded-full bg-white" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Puncak Aktivitas Posting</span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {peakHour ? formatWib(peakHour.hour, "time") : "1 jam lalu"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Volume puncak tercatat {peakHour ? formatInteger(peakHour.volume) : "0"} posting/jam pada kanal agregasi.
                  </p>
                </div>
              </div>

              {/* Event 3 */}
              <div className="relative">
                <div className="absolute -left-[27px] top-0 flex size-5 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-white text-white">
                  <div className="size-1.5 rounded-full bg-white" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Sinkronisasi Ingesti Data</span>
                    <span className="text-[10px] font-semibold text-slate-400">2 jam lalu</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Feed RSS berita daring & kanal YouTube berhasil disinkronkan tanpa galat.
                  </p>
                </div>
              </div>

              {/* Event 4 */}
              <div className="relative">
                <div className="absolute -left-[27px] top-0 flex size-5 items-center justify-center rounded-full bg-indigo-500 ring-4 ring-white text-white">
                  <div className="size-1.5 rounded-full bg-white" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Audit Sesi Pengguna</span>
                    <span className="text-[10px] font-semibold text-slate-400">Hari ini</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sesi operasional {me.user.name} terverifikasi aman di audit log.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <Link
                href="/alerts"
                className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1"
              >
                <span>Lihat Seluruh Riwayat Kasus</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 24-Hour Trend Section (Denyut Isu 24 Jam) */}
      <div className="card-modern p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 mb-5">
          <div>
            <h2 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
              <Activity className="size-4 text-blue-600" />
              <span>{ui.dashboard.trend.title}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {ui.dashboard.trend.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-1 text-slate-600">
              <span className="text-slate-400">{ui.dashboard.trend.totalPosts}:</span>
              <strong className="font-mono font-black text-slate-800">
                {formatInteger(totalVolume)}
              </strong>
            </span>
            {peakHour && (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1 text-blue-800">
                <span className="text-blue-600 font-medium">{ui.dashboard.trend.peakHour}:</span>
                <strong className="font-mono font-black">
                  {formatWib(peakHour.hour, "time")} ({formatInteger(peakHour.volume)} posting)
                </strong>
              </span>
            )}
          </div>
        </div>

        <DashboardChart data={trendPoints} />
      </div>

      {/* Quick Action Shortcuts (Pintasan Modul Cepat) */}
      <div className="card-modern p-6">
        <div>
          <h3 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" />
            <span>{ui.dashboard.quickLinks.title}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Pintasan akses instan ke seluruh modul operasional sistem peringatan dini.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {can("alerts.triage") && (
            <Link
              href="/alerts?status=new"
              className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-center transition-all hover:bg-white hover:border-blue-200 hover:shadow-sm group"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Inbox className="size-5" />
              </div>
              <span className="text-xs font-bold text-slate-700 group-hover:text-blue-600 transition-colors">
                {ui.dashboard.quickLinks.triageAlerts}
              </span>
            </Link>
          )}

          {can("alerts.decide") && (
            <Link
              href="/alerts?status=escalated"
              className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-center transition-all hover:bg-white hover:border-amber-200 hover:shadow-sm group"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <ArrowUpRight className="size-5" />
              </div>
              <span className="text-xs font-bold text-slate-700 group-hover:text-amber-600 transition-colors">
                {ui.dashboard.quickLinks.reviewEscalated}
              </span>
            </Link>
          )}

          {can("topics.manage") && (
            <Link
              href="/topics"
              className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-center transition-all hover:bg-white hover:border-purple-200 hover:shadow-sm group"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Hash className="size-5" />
              </div>
              <span className="text-xs font-bold text-slate-700 group-hover:text-purple-600 transition-colors">
                {ui.dashboard.quickLinks.viewTopics}
              </span>
            </Link>
          )}

          {can("briefings.view") && (
            <Link
              href="/briefings"
              className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-center transition-all hover:bg-white hover:border-emerald-200 hover:shadow-sm group"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <FileText className="size-5" />
              </div>
              <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-600 transition-colors">
                {ui.dashboard.quickLinks.viewBriefings}
              </span>
            </Link>
          )}

          {can("labels.manage") && (
            <Link
              href="/labeling"
              className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-center transition-all hover:bg-white hover:border-rose-200 hover:shadow-sm group"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <Tag className="size-5" />
              </div>
              <span className="text-xs font-bold text-slate-700 group-hover:text-rose-600 transition-colors">
                {ui.dashboard.quickLinks.labelingQueue}
              </span>
            </Link>
          )}

          {can("evaluation.view") && (
            <Link
              href="/evaluation"
              className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-center transition-all hover:bg-white hover:border-sky-200 hover:shadow-sm group"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                <CheckSquare className="size-5" />
              </div>
              <span className="text-xs font-bold text-slate-700 group-hover:text-sky-600 transition-colors">
                {ui.dashboard.quickLinks.evaluation}
              </span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
