import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/admin/replay" }));

import { REPLAY_LIST_EMPTY, REPLAY_LIST_IDLE, REPLAY_LIST_RUNNING } from "@/fixtures/replay";
import { ui } from "@/lib/labels";
import { availableAction, errorCodes, uploadErrors } from "@/lib/replay";
import { EMPTY_UPLOAD, ReplayView, type ReplayViewProps } from "./replay-view";

const noop = () => undefined;
const base: ReplayViewProps = {
  result: REPLAY_LIST_IDLE,
  loading: false,
  failed: false,
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
  composition: null,
  trend: { series: null, failed: false, window: null, clockNow: null },
};
const render = (props: Partial<ReplayViewProps> = {}) => renderToString(createElement(ReplayView, { ...base, ...props }));

describe("replay rules", () => {
  it("allows stop while running, start when nothing else runs, otherwise blocks", () => {
    expect(availableAction({ status: "running" }, false)).toBe("stop");
    expect(availableAction({ status: "idle" }, false)).toBe("start");
    expect(availableAction({ status: "finished" }, true)).toBe("blocked");
  });

  it("flattens error codes and splits upload rows", () => {
    expect(errorCodes({ errors: { scenario: ["already_running"] } })).toEqual(["already_running"]);
    expect(errorCodes(null)).toEqual([]);
    expect(uploadErrors({ errors: { file: ["invalid_rows"], rows: ["2:invalid_phase", "x"], name: ["required"] } })).toEqual({
      fields: { name: ["required"] },
      file: ["invalid_rows"],
      rows: [
        { line: "2", code: "invalid_phase" },
        { line: "", code: "x" },
      ],
    });
  });
});

describe("ReplayView", () => {
  it("shows the data clock banner only while the payload carries clock_now", () => {
    expect(render()).not.toContain(ui.simulation.dataClockLabel);
    const running = render({ result: REPLAY_LIST_RUNNING });
    expect(running).toContain(ui.simulation.dataClockLabel);
    expect(running).toContain("DATA SIMULASI");
  });

  it("offers Start for an idle scenario and Stop for a running one, each behind a confirmation", () => {
    const idle = render();
    expect(idle).toContain(ui.replay.start);
    expect(idle).not.toContain(`>${ui.replay.stop}<`);
    const running = render({ result: REPLAY_LIST_RUNNING });
    expect(running).toContain(ui.replay.stop);
    expect(running).toContain("<dialog");
  });

  it("blocks starting another scenario while one runs", () => {
    expect(render({ result: REPLAY_LIST_RUNNING, selectedId: 2 })).toContain(ui.replay.anotherRunningHint);
  });

  it("shows API error codes, an invalid speed, and upload row problems inline", () => {
    expect(render({ actionErrors: ["already_running"] })).toContain("Skenario ini sedang berjalan");
    expect(render({ speed: "0" })).toContain(ui.replay.invalidSpeed);
    const upload = render({ upload: { ...EMPTY_UPLOAD, file: ["invalid_rows"], rows: [{ line: "2", code: "invalid_phase" }] } });
    expect(upload).toContain("Ada baris yang tidak valid");
    expect(upload).toContain("Kolom phase harus berisi baseline atau incident");
  });

  it("names a stop caused by a lost heartbeat as an error", () => {
    expect(render({ selectedId: 3 })).toContain("Proses Replay berhenti memberi kabar");
  });

  it("states that there are no scenarios yet and marks every row as simulated", () => {
    expect(render({ result: REPLAY_LIST_EMPTY, selectedId: null })).toContain(ui.replay.empty);
    expect(render().match(/DATA SIMULASI/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("shows the growing volume chart only while the data clock is running", () => {
    const series = [
      { hour: "2026-10-28T08:00:00.000Z", volume: 4 },
      { hour: "2026-10-28T09:00:00.000Z", volume: 7 },
    ];
    const live = render({
      trend: { series, failed: false, window: { start: "2026-10-28T09:00:00.000Z", end: "2026-10-28T09:30:00.000Z" }, clockNow: "2026-10-28T09:30:00.000Z" },
    });
    expect(live).toContain("Volume posting selama Replay");
    expect(live).toContain("Jam data");

    const idle = render();
    expect(idle).not.toContain("Volume posting selama Replay");
  });
});
