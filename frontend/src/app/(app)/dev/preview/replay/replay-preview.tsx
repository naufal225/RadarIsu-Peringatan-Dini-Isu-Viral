"use client";

import { useState } from "react";
import { PageHeader } from "@/components/radar/page-header";
import { EMPTY_UPLOAD, ReplayView, type ReplayViewProps } from "@/components/replay/replay-view";
import { REPLAY_LIST_EMPTY, REPLAY_LIST_IDLE, REPLAY_LIST_RUNNING } from "@/fixtures/replay";
import { ui } from "@/lib/labels";
import { replayStatusLabels } from "@/lib/labels/replay";

const noop = () => undefined;

const BASE: ReplayViewProps = {
  result: REPLAY_LIST_IDLE,
  loading: false,
  failed: false,
  onRetry: noop,
  selectedId: 1,
  onSelect: noop,
  speed: "600",
  onSpeedChange: noop,
  confirming: null,
  onAsk: noop,
  onCancel: noop,
  onConfirm: noop,
  actionPending: false,
  actionErrors: [],
  upload: EMPTY_UPLOAD,
  onUpload: noop,
};

const CASES: { title: string; props: Partial<ReplayViewProps> }[] = [
  { title: ui.preview.normal, props: {} },
  { title: `${ui.preview.normal} · ${replayStatusLabels.running}`, props: { result: REPLAY_LIST_RUNNING } },
  { title: `${ui.preview.normal} · ${ui.replay.anotherRunningHint}`, props: { result: REPLAY_LIST_RUNNING, selectedId: 2, actionErrors: ["another_running"] } },
  { title: ui.preview.empty, props: { result: REPLAY_LIST_EMPTY, selectedId: null } },
  { title: ui.preview.loading, props: { result: null, loading: true, selectedId: null } },
  { title: ui.preview.error, props: { result: null, failed: true, selectedId: null } },
  {
    title: ui.preview.invalid,
    props: {
      upload: {
        ...EMPTY_UPLOAD,
        fields: { name: ["Nama wajib diisi"] },
        file: ["invalid_rows"],
        rows: [
          { line: "2", code: "invalid_offset_seconds" },
          { line: "7", code: "invalid_phase" },
        ],
      },
    },
  },
];

/** /dev/preview/replay: ReplayView dengan fixture. Kasus pertama interaktif (pilih skenario, kecepatan, dialog). */
export function ReplayPreview() {
  const [selectedId, setSelectedId] = useState<number | null>(1);
  const [speed, setSpeed] = useState("600");
  const [confirming, setConfirming] = useState<"start" | "stop" | null>(null);

  return (
    <>
      <PageHeader title={ui.preview.title(ui.replay.title)} subtitle={ui.preview.subtitle} />
      {CASES.map(({ title, props }, index) => (
        <section key={title} className="mb-12 border-t border-line pt-6">
          <h2 className="mb-4 text-section font-semibold text-ink-muted">{title}</h2>
          <ReplayView
            {...BASE}
            {...(index === 0
              ? { selectedId, onSelect: setSelectedId, speed, onSpeedChange: setSpeed, confirming, onAsk: setConfirming, onCancel: () => setConfirming(null), onConfirm: () => setConfirming(null) }
              : {})}
            {...props}
          />
        </section>
      ))}
    </>
  );
}
