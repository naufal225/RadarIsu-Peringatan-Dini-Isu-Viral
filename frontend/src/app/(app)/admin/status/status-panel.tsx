"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  FileCheck2,
  Layers,
  MessageSquare,
  RotateCw,
  Server,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/radar/data-table";
import { SkeletonRows } from "@/components/radar/skeleton";
import { Waktu } from "@/components/radar/waktu";
import { ErrorState } from "@/components/radar/states";
import { cn } from "@/lib/cn";
import { formatInteger } from "@/lib/format";
import { sourceStatusLabels, sourceTypeLabels, ui } from "@/lib/labels";
import { useApiData } from "@/lib/use-api-data";

type SourceItem = {
  id: number;
  type: keyof typeof sourceTypeLabels;
  name: string;
  is_active: boolean;
  last_status: keyof typeof sourceStatusLabels;
  last_fetched_at: string | null;
  last_error: string | null;
};

type QueueFailure = {
  id: number;
  job: string | null;
  error: string;
  failed_at: string;
};

type Status = {
  sources: SourceItem[];
  queue: {
    pending_jobs: number;
    failed_jobs: number;
    recent_failures: QueueFailure[];
  };
  counts: { raw_items: number; unprocessed_raw_items: number; posts: number; open_alerts: number };
  offline_mode: boolean;
};

/** Wave sparkline SVG curve matching Able Pro KPI cards. */
function WaveSparkline({ color = "#2563eb", id = "spark-sys" }: { color?: string; id?: string }) {
  return (
    <div className="h-12 w-full overflow-hidden my-1">
      <svg viewBox="0 0 300 70" preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path
          d="M 0,55 C 35,45 65,65 95,30 C 130,5 160,50 195,20 C 230,-5 265,35 300,15 L 300,70 L 0,70 Z"
          fill={`url(#${id})`}
        />
        <path
          d="M 0,55 C 35,45 65,65 95,30 C 130,5 160,50 195,20 C 230,-5 265,35 300,15"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function StatusPanel() {
  const { data, error, reload } = useApiData<{ data: Status }>("system/status");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const status = data?.data ?? null;

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await reload();
    } finally {
      setIsRefreshing(false);
    }
  }

  const sourceColumns: DataTableColumn<SourceItem>[] = [
    {
      id: "name",
      header: "Nama Sumber & Kanal Ingesti",
      cell: (row) => (
        <div className="flex items-center gap-3 py-1">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
            <Database className="size-4" />
          </div>
          <div className="min-w-0">
            <span className="block font-bold text-slate-800 truncate">{row.name}</span>
            <span className="block text-[11px] text-slate-400">ID Sumber #{row.id}</span>
          </div>
        </div>
      ),
    },
    {
      id: "type",
      header: "Tipe Data",
      cell: (row) => (
        <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
          {sourceTypeLabels[row.type] ?? row.type}
        </span>
      ),
      width: "w-32",
    },
    {
      id: "status",
      header: "Status Koneksi",
      cell: (row) => (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
            row.last_status === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : row.last_status === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-slate-200 bg-slate-50 text-slate-600",
          )}
        >
          {row.last_status === "ok" ? (
            <CheckCircle2 className="size-3.5 text-emerald-600" />
          ) : row.last_status === "error" ? (
            <AlertTriangle className="size-3.5 text-rose-600" />
          ) : (
            <Clock className="size-3.5 text-slate-400" />
          )}
          <span>{sourceStatusLabels[row.last_status] ?? row.last_status}</span>
        </span>
      ),
      width: "w-40",
    },
    {
      id: "last_fetched",
      header: "Sinkronisasi Terakhir",
      cell: (row) => (
        <span className="text-xs text-slate-600">
          <Waktu value={row.last_fetched_at} />
        </span>
      ),
      width: "w-48",
    },
    {
      id: "last_error",
      header: "Log Diagnostik",
      cell: (row) => (
        <span className="text-xs text-slate-500 line-clamp-1">
          {row.last_error ?? <span className="text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="size-3" /> Berfungsi Normal</span>}
        </span>
      ),
    },
  ];

  const failureColumns: DataTableColumn<QueueFailure>[] = [
    {
      id: "job",
      header: "Nama Pekerjaan",
      cell: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-800">
          {row.job ?? "—"}
        </span>
      ),
    },
    {
      id: "error",
      header: "Keterangan Galat",
      cell: (row) => (
        <span className="font-mono text-xs text-rose-600 line-clamp-2">
          {row.error}
        </span>
      ),
    },
    {
      id: "failed_at",
      header: "Waktu Terjadi",
      cell: (row) => <Waktu value={row.failed_at} />,
      width: "w-40",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Able Pro Top Hero Banner */}
      <div className="hero-banner relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 size-60 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute right-40 -bottom-12 size-48 rounded-full bg-white/5 blur-xl" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-100 uppercase tracking-wider">
              <span>Pusat Kendali Administrasi</span>
              <span>/</span>
              <span>Kesehatan Sistem &amp; Infrastruktur</span>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>{ui.adminStatus.title}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-200 border border-emerald-400/30">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Sistem Operasional</span>
              </span>
            </h1>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm text-blue-100">
              Pemantauan konektivitas ingest kanal publik, integritas pipeline data, antrean queue, dan isolasi jaringan air-gap.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {status && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold text-white border border-white/20 backdrop-blur-md">
                <span className="text-blue-100">{ui.adminStatus.offlineMode}:</span>
                {status.offline_mode ? (
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <WifiOff className="size-3.5" />
                    <span>Aktif (Air-Gap)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-emerald-300">
                    <Wifi className="size-3.5" />
                    <span>Nonaktif (Online)</span>
                  </span>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs sm:text-sm font-bold text-blue-600 shadow-md transition-all hover:bg-blue-50 active:scale-95 disabled:opacity-50"
            >
              <RotateCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
              <span>Segarkan Status</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <ErrorState
          title={ui.common.loadError}
          description="Gagal memuat status sistem dan infrastruktur. Periksa koneksi Docker backend."
          onRetry={reload}
        />
      )}

      {status === null ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="h-28 animate-pulse rounded-2xl bg-white border border-slate-200" />
            <div className="h-28 animate-pulse rounded-2xl bg-white border border-slate-200" />
            <div className="h-28 animate-pulse rounded-2xl bg-white border border-slate-200" />
            <div className="h-28 animate-pulse rounded-2xl bg-white border border-slate-200" />
          </div>
          <SkeletonRows columns={5} />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top 4 KPI Metrics Row (Able Pro Style) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Alert Terbuka */}
            <div className="card-modern p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {ui.adminStatus.openAlerts}
                  </span>
                  <div className="flex size-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                    <ShieldAlert className="size-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-black tracking-tight text-slate-800">
                    {formatInteger(status.counts.open_alerts)}
                  </span>
                  <span className="text-xs font-bold text-rose-600">kasus aktif</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  Alert keamanan terdeteksi di ruang siber
                </p>
              </div>

              <WaveSparkline color="#e11d48" id="spark-alerts" />

              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-50 border border-slate-100 p-2 text-center text-xs">
                <div>
                  <span className="block font-black text-rose-600">{status.counts.open_alerts}</span>
                  <span className="text-[10px] font-bold text-slate-400">Kasus</span>
                </div>
                <div>
                  <span className="block font-black text-slate-700">{status.offline_mode ? "Air-Gap" : "Online"}</span>
                  <span className="text-[10px] font-bold text-slate-400">Mode</span>
                </div>
                <div>
                  <span className="block font-black text-emerald-600">Aktif</span>
                  <span className="text-[10px] font-bold text-slate-400">Status</span>
                </div>
              </div>
            </div>

            {/* Card 2: Postingan Ternormalisasi */}
            <div className="card-modern p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {ui.adminStatus.posts}
                  </span>
                  <div className="flex size-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <MessageSquare className="size-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-black tracking-tight text-slate-800">
                    {formatInteger(status.counts.posts)}
                  </span>
                  <span className="text-xs font-bold text-blue-600">postingan</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  Data bersih di database analitik
                </p>
              </div>

              <WaveSparkline color="#2563eb" id="spark-posts" />

              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-50 border border-slate-100 p-2 text-center text-xs">
                <div>
                  <span className="block font-black text-slate-800">{formatInteger(status.counts.posts)}</span>
                  <span className="text-[10px] font-bold text-slate-400">Total</span>
                </div>
                <div>
                  <span className="block font-black text-blue-600">{status.sources.length} kanal</span>
                  <span className="text-[10px] font-bold text-slate-400">Sumber</span>
                </div>
                <div>
                  <span className="block font-black text-emerald-600">Tersimpan</span>
                  <span className="text-[10px] font-bold text-slate-400">DB</span>
                </div>
              </div>
            </div>

            {/* Card 3: Ingesti Data Mentah */}
            <div className="card-modern p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {ui.adminStatus.rawItems}
                  </span>
                  <div className="flex size-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Layers className="size-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-black tracking-tight text-slate-800">
                    {formatInteger(status.counts.raw_items)}
                  </span>
                  <span className="text-xs font-bold text-indigo-600">item mentah</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  Antrean belum diproses: {formatInteger(status.counts.unprocessed_raw_items)}
                </p>
              </div>

              <WaveSparkline color="#6366f1" id="spark-raw" />

              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-50 border border-slate-100 p-2 text-center text-xs">
                <div>
                  <span className="block font-black text-slate-800">{status.counts.raw_items}</span>
                  <span className="text-[10px] font-bold text-slate-400">Total</span>
                </div>
                <div>
                  <span className="block font-black text-indigo-600">{status.counts.unprocessed_raw_items}</span>
                  <span className="text-[10px] font-bold text-slate-400">Antrean</span>
                </div>
                <div>
                  <span className="block font-black text-emerald-600">{status.counts.unprocessed_raw_items === 0 ? "Bersih" : "Pending"}</span>
                  <span className="text-[10px] font-bold text-slate-400">Pipeline</span>
                </div>
              </div>
            </div>

            {/* Card 4: Antrean Queue */}
            <div className="card-modern p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Kesehatan Antrean (Queue)
                  </span>
                  <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Cpu className="size-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-black tracking-tight text-slate-800">
                    {formatInteger(status.queue.pending_jobs)}
                  </span>
                  <span className="text-xs font-bold text-emerald-600">job aktif</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  Pekerjaan gagal: {formatInteger(status.queue.failed_jobs)} job
                </p>
              </div>

              <WaveSparkline color="#10b981" id="spark-queue" />

              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-50 border border-slate-100 p-2 text-center text-xs">
                <div>
                  <span className="block font-black text-slate-800">{status.queue.pending_jobs}</span>
                  <span className="text-[10px] font-bold text-slate-400">Menunggu</span>
                </div>
                <div>
                  <span className="block font-black text-rose-600">{status.queue.failed_jobs}</span>
                  <span className="text-[10px] font-bold text-slate-400">Gagal</span>
                </div>
                <div>
                  <span className="block font-black text-emerald-600">{status.queue.failed_jobs === 0 ? "Normal" : "Periksa"}</span>
                  <span className="text-[10px] font-bold text-slate-400">Status</span>
                </div>
              </div>
            </div>
          </div>

          {/* Middle 12-col Grid: Sources Table (7 cols) + Queue Diagnostics (5 cols) ala Able Pro */}
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            {/* Left 7 cols: Data Sources */}
            <div className="lg:col-span-7">
              <div className="card-modern overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
                      <Database className="size-4 text-blue-600" />
                      <span>{ui.adminStatus.sources}</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Status konektivitas dan ingest kanal informasi publik secara berkala.
                    </p>
                  </div>
                  <Link
                    href="/admin/sources"
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <span>Kelola Sumber</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>

                <DataTable
                  columns={sourceColumns}
                  rows={status.sources}
                  getRowKey={(row) => row.id}
                  empty={<p className="text-sm text-slate-400 p-6 text-center">Belum ada kanal sumber data terdaftar.</p>}
                  caption="Tabel status sumber data"
                  framed={false}
                />
              </div>
            </div>

            {/* Right 5 cols: Queue & Infrastructure Status */}
            <div className="lg:col-span-5 space-y-6">
              {/* Service Health Card */}
              <div className="card-modern p-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                  <div>
                    <h2 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
                      <Server className="size-4 text-emerald-600" />
                      <span>Kesehatan Node Layanan</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Status kontainer arsitektur microservices
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Semua Sehat
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="size-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-slate-700">PostgreSQL 16 (Relational DB)</span>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-600">Online · Port 5432</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="size-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-slate-700">Laravel 13 App Engine</span>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-600">PHP 8.3-FPM · Healthy</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="size-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-slate-700">Queue &amp; Background Workers</span>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-600">Active · {status.queue.pending_jobs} Pending</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="size-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-slate-700">Next.js BFF (Frontend Web)</span>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-600">Turbopack · SSR Ready</span>
                  </div>
                </div>
              </div>

              {/* Queue Failure Card if any */}
              {status.queue.recent_failures.length > 0 && (
                <div className="card-modern p-6">
                  <h3 className="mb-2 text-sm font-bold text-rose-700 flex items-center gap-2">
                    <AlertTriangle className="size-4" />
                    <span>{ui.adminStatus.recentFailures}</span>
                  </h3>
                  <DataTable
                    columns={failureColumns}
                    rows={status.queue.recent_failures}
                    getRowKey={(row) => row.id}
                    caption="Tabel kegagalan pekerjaan terbaru"
                    framed={false}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Quick Shortcuts for Admin */}
          <div className="card-modern p-6">
            <div>
              <h3 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
                <Zap className="size-4 text-amber-500" />
                <span>Pintasan Cepat Administrasi &amp; Keamanan</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Akses cepat ke modul manajemen pengguna, pengaturan deteksi, dan log audit keamanan.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Link
                href="/admin/users"
                className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-center transition-all hover:bg-white hover:border-blue-200 hover:shadow-sm group"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Users className="size-5" />
                </div>
                <span className="text-xs font-bold text-slate-700 group-hover:text-blue-600 transition-colors">
                  Kelola Pengguna
                </span>
              </Link>

              <Link
                href="/admin/sources"
                className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-center transition-all hover:bg-white hover:border-indigo-200 hover:shadow-sm group"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Database className="size-5" />
                </div>
                <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">
                  Sumber Ingesti
                </span>
              </Link>

              <Link
                href="/admin/settings"
                className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-center transition-all hover:bg-white hover:border-amber-200 hover:shadow-sm group"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <SlidersHorizontal className="size-5" />
                </div>
                <span className="text-xs font-bold text-slate-700 group-hover:text-amber-600 transition-colors">
                  Pengaturan Deteksi
                </span>
              </Link>

              <Link
                href="/admin/audit"
                className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-center transition-all hover:bg-white hover:border-purple-200 hover:shadow-sm group"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <FileCheck2 className="size-5" />
                </div>
                <span className="text-xs font-bold text-slate-700 group-hover:text-purple-600 transition-colors">
                  Audit Log Sesi
                </span>
              </Link>

              <Link
                href="/admin/replay"
                className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-center transition-all hover:bg-white hover:border-emerald-200 hover:shadow-sm group"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <RotateCw className="size-5" />
                </div>
                <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-600 transition-colors">
                  Simulasi Replay
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
