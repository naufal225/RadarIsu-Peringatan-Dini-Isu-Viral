"use client";

import { useState } from "react";
import { LabelingView } from "@/components/labeling/labeling-view";
import { api } from "@/lib/api";
import type { LabelingDaily, LabelingPost, LabelingResponse, LabelingStatusFilter, ManualLabel } from "@/lib/api-types/labeling";
import { labelingQuery } from "@/lib/labeling";
import { ui } from "@/lib/labels";
import { useApiData } from "@/lib/use-api-data";

/** Pengambil data /labeling. Setelah label tersimpan, antrean dan penghitung dimuat ulang dari server. */
export function LabelingData() {
  const [status, setStatus] = useState<LabelingStatusFilter>("unlabeled");
  const [simulatedOnly, setSimulatedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApiData<LabelingResponse>(labelingQuery({ status, simulatedOnly, page }));
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<{ id: number; text: string } | null>(null);
  // Sebaran harian hanya pelengkap: gagal diam-diam, antrean tetap jalan.
  const daily = useApiData<{ data: LabelingDaily[] }>("labeling/daily").data?.data ?? null;

  async function label(post: LabelingPost, value: ManualLabel | null) {
    setBusyId(post.id);
    setRowError(null);
    try {
      await api(`labeling/posts/${post.id}`, { method: "PUT", body: JSON.stringify({ label_manual: value }) });
      reload();
    } catch {
      setRowError({ id: post.id, text: ui.common.actionError });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <LabelingView
      result={data}
      loading={loading}
      failed={error && data === null}
      onRetry={reload}
      status={status}
      onStatusChange={(next) => {
        setStatus(next);
        setPage(1);
      }}
      simulatedOnly={simulatedOnly}
      onSimulatedOnlyChange={(next) => {
        setSimulatedOnly(next);
        setPage(1);
      }}
      onPageChange={setPage}
      busyId={busyId}
      rowError={rowError}
      onLabel={label}
      daily={daily}
    />
  );
}
