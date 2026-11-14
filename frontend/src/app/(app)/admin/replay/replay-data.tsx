"use client";

import { useEffect, useState } from "react";
import { EMPTY_UPLOAD, ReplayView, type UploadState } from "@/components/replay/replay-view";
import { api, ApiError } from "@/lib/api";
import type { ReplayListResponse, ReplayScenario } from "@/lib/api-types/replay";
import type { SignalPoint } from "@/lib/signal-chart";
import { errorCodes, isRunning, POLL_MS, uploadErrors } from "@/lib/replay";
import { incidentWindow, replayTrend, utcDay } from "@/lib/replay-trend";
import { type MetricsResponse, type Topic } from "@/lib/topics";
import { useApiData } from "@/lib/use-api-data";

/** Pengambil data /admin/replay. Polling hanya selama ada skenario berstatus running. */
export function ReplayData() {
  const { data, error, loading, reload } = useApiData<ReplayListResponse>("replay/scenarios");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [speed, setSpeed] = useState("");
  const [confirming, setConfirming] = useState<"start" | "stop" | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionErrors, setActionErrors] = useState<string[]>([]);
  const [upload, setUpload] = useState<UploadState>(EMPTY_UPLOAD);

  const scenarios = data?.data ?? [];
  const anyRunning = scenarios.some(isRunning);
  // Tanpa pilihan, skenario yang berjalan (atau yang pertama) ditampilkan di panel kontrol.
  const effectiveId = selectedId ?? scenarios.find(isRunning)?.id ?? scenarios[0]?.id ?? null;
  const effective = scenarios.find((s) => s.id === effectiveId) ?? null;

  // Grafik volume tumbuh mengikuti jam data. Hanya selama skenario berjalan; setiap polling membawa clock_now baru.
  const clockNow = data?.meta.clock_now ?? null;
  const anchor = effective?.virtual_anchor_at ?? null;
  const trendLive = effective?.status === "running" && anchor !== null && clockNow !== null;
  const [trend, setTrend] = useState<{ series: SignalPoint[] | null; failed: boolean }>({ series: null, failed: false });

  useEffect(() => {
    // Di luar kondisi live, data lama disembunyikan oleh trendLive di render; tidak perlu reset di sini.
    if (!trendLive || anchor === null || clockNow === null) return;
    let cancelled = false;
    const anchorDate = new Date(anchor);
    const clockDate = new Date(clockNow);
    const range = `from=${utcDay(anchorDate)}&to=${utcDay(clockDate)}`;

    (async () => {
      try {
        const topics = await api<{ data: Topic[] }>("topics");
        const rows = await Promise.all(
          topics.data.filter((t) => t.is_active).map((t) => api<MetricsResponse>(`topics/${t.id}/metrics?${range}`).then((r) => r.data)),
        );
        if (!cancelled) setTrend({ series: replayTrend(rows, anchorDate, clockDate), failed: false });
      } catch {
        if (!cancelled) setTrend({ series: null, failed: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [trendLive, anchor, clockNow]);

  useEffect(() => {
    if (!anyRunning) return;
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [anyRunning, reload]);

  function select(id: number) {
    setSelectedId(id);
    setSpeed("");
    setActionErrors([]);
  }

  const speedFor = (s: ReplayScenario | null) => (speed === "" && s ? String(s.default_speed_factor) : speed);

  async function confirm() {
    if (!effective || !confirming) return;
    setActionPending(true);
    setActionErrors([]);
    try {
      await api(`replay/scenarios/${effective.id}/${confirming}`, {
        method: "POST",
        body: confirming === "start" ? JSON.stringify({ speed_factor: Number(speedFor(effective)) }) : undefined,
      });
      reload();
    } catch (e) {
      const codes = e instanceof ApiError ? errorCodes(e.body) : [];
      setActionErrors(codes.length > 0 ? codes : ["action_failed"]);
    } finally {
      setActionPending(false);
      setConfirming(null);
    }
  }

  async function submitUpload(form: FormData) {
    setUpload({ ...EMPTY_UPLOAD, busy: true });
    try {
      const created = await api<{ data: ReplayScenario }>("replay/scenarios", { method: "POST", body: form });
      setUpload({ ...EMPTY_UPLOAD, done: created.data.name });
      setSelectedId(created.data.id);
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setUpload({ ...EMPTY_UPLOAD, ...uploadErrors(e.body) });
      else setUpload({ ...EMPTY_UPLOAD, failed: true });
    }
  }

  return (
    <ReplayView
      result={data}
      loading={loading}
      failed={error && data === null}
      onRetry={reload}
      selectedId={effectiveId}
      onSelect={select}
      speed={speedFor(effective)}
      onSpeedChange={setSpeed}
      confirming={confirming}
      onAsk={(action) => {
        setActionErrors([]);
        setConfirming(action);
      }}
      onCancel={() => setConfirming(null)}
      onConfirm={confirm}
      actionPending={actionPending}
      actionErrors={actionErrors}
      upload={upload}
      onUpload={submitUpload}
      trend={{
        series: trendLive ? trend.series : null,
        failed: trend.failed,
        window: trendLive ? incidentWindow(anchor, effective?.incident_start_offset_seconds ?? null, clockNow) : null,
        clockNow: trendLive ? clockNow : null,
      }}
    />
  );
}
