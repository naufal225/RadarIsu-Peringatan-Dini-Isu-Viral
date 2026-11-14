"use client";

import { useEffect, useState } from "react";
import { EMPTY_UPLOAD, ReplayView, type UploadState } from "@/components/replay/replay-view";
import { api, ApiError } from "@/lib/api";
import type { ReplayComposition, ReplayListResponse, ReplayScenario, ReplaySeries } from "@/lib/api-types/replay";
import { errorCodes, isRunning, POLL_MS, uploadErrors } from "@/lib/replay";
import { minuteTrend } from "@/lib/replay-trend";
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
  // Komposisi baris skenario yang terpilih; statis, cukup diambil sekali per skenario.
  const composition = useApiData<{ data: ReplayComposition }>(effective ? `replay/scenarios/${effective.id}/composition` : null).data?.data ?? null;

  // Grafik posting per menit data. Hanya selama skenario berjalan; setiap polling membawa clock_now baru,
  // dan `until` memastikan server tidak mengirim posting yang belum sampai di jam data.
  const clockNow = data?.meta.clock_now ?? null;
  const trendLive = effective?.status === "running" && clockNow !== null;
  const seriesState = useApiData<{ data: ReplaySeries }>(
    trendLive && effective ? `replay/scenarios/${effective.id}/series?until=${encodeURIComponent(clockNow)}` : null,
  );
  const trend = {
    series: trendLive && seriesState.data ? minuteTrend(seriesState.data.data.points, new Date(clockNow)) : null,
    failed: seriesState.error,
    clockNow: trendLive ? clockNow : null,
  };

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
      composition={composition}
      trend={trend}
    />
  );
}
