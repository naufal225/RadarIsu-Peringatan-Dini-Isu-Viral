import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/admin/settings" }));

import { DEFAULT_DETECTION, DETECTION_NEVER_CHANGED, DETECTION_RESPONSE, OFFLINE_RESPONSE } from "@/fixtures/settings";
import { isFieldInvalid, isOutOfRange, setPath } from "@/lib/detection-settings";
import { ui } from "@/lib/labels";
import { SettingsView, type SettingsViewProps } from "./settings-view";

const noop = () => undefined;
const base: SettingsViewProps = {
  loaded: DETECTION_RESPONSE.data,
  loading: false,
  failed: false,
  draft: DEFAULT_DETECTION,
  onChange: noop,
  serverFields: [],
  pending: false,
  saveFailed: false,
  saved: false,
  onSubmit: noop,
  onReset: noop,
  offline: { loaded: OFFLINE_RESPONSE.data, enabled: false, onToggle: noop, onSave: noop, pending: false, saved: false, failed: false },
};
const render = (props: Partial<SettingsViewProps> = {}) => renderToString(createElement(SettingsView, { ...base, ...props }));

describe("field checks", () => {
  it("flags a field by its own path or by its group from a 422", () => {
    expect(isFieldInvalid(new Set(["weights"]), "weights.spike")).toBe(true);
    expect(isFieldInvalid(new Set(["z_threshold"]), "weights.spike")).toBe(false);
  });

  it("knows when a value leaves its range or must be whole", () => {
    expect(isOutOfRange({ ...DEFAULT_DETECTION, z_threshold: 12 }, "z_threshold")).toBe(true);
    expect(isOutOfRange({ ...DEFAULT_DETECTION, min_volume: 2.5 }, "min_volume")).toBe(true);
    expect(isOutOfRange(DEFAULT_DETECTION, "z_threshold")).toBe(false);
  });
});

describe("SettingsView", () => {
  it("shows every group with field hints and the weight total without green", () => {
    const html = render();
    for (const title of Object.values(ui.settings.groups)) expect(html).toContain(title);
    expect(html).toContain(ui.settings.weightsTotal(100));
    expect(html).not.toMatch(/green-|emerald-/);
  });

  it("warns when the weights do not add up to 100 and explains a value out of range under its field", () => {
    const html = render({ draft: { ...DEFAULT_DETECTION, weights: { spike: 50, anomaly: 30, sentiment: 20, reach: 10 }, z_threshold: 12 } });
    expect(html).toContain(ui.settings.weightsTotal(110));
    expect(html).toContain(ui.settings.weightsWarning);
    expect(html).toContain(ui.settings.outOfRange("2", "10", false));
  });

  it("names a field the server rejected", () => {
    expect(render({ serverFields: ["cooldown_minutes"] })).toContain(ui.settings.serverRejected);
  });

  it("shows who changed the settings last, or that they are still the defaults", () => {
    expect(render()).toContain(ui.settings.lastUpdatedBy("Admin Demo"));
    expect(render({ loaded: DETECTION_NEVER_CHANGED.data })).toContain(ui.settings.neverUpdated);
  });

  it("renders severity in the preview as badges with text", () => {
    expect(render()).toMatch(/Tinggi|Sedang|Rendah/);
  });

  it("shows loading and error states", () => {
    expect(render({ loaded: null, draft: null, loading: true })).toContain('aria-busy="true"');
    expect(render({ loaded: null, draft: null, failed: true })).toContain('role="alert"');
  });
});

describe("unsaved changes", () => {
  it("shows the stored value under an edited field and counts the pending changes", () => {
    const html = render({ draft: setPath(DEFAULT_DETECTION, "z_threshold", 3.5) });
    expect(html).toContain(ui.settings.was("3"));
    expect(html).toContain(ui.settings.pendingChanges(1));
  });

  it("confirms before saving and lists each change there", () => {
    const html = render({ draft: setPath(DEFAULT_DETECTION, "z_threshold", 3.5) });
    expect(html).toContain(ui.settings.confirmBody);
    expect(html).toContain(ui.settings.changeList);
    expect(html).toMatch(/3,5/);
  });
});
