import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/labeling" }));

import { LABELING_DONE, LABELING_PAGE } from "@/fixtures/labeling";
import { ui } from "@/lib/labels";
import { LabelingView, type LabelingViewProps } from "./labeling-view";

const noop = () => undefined;
const base: LabelingViewProps = {
  result: LABELING_PAGE,
  loading: false,
  failed: false,
  status: "all",
  onStatusChange: noop,
  simulatedOnly: false,
  onSimulatedOnlyChange: noop,
  onPageChange: noop,
  busyId: null,
  rowError: null,
  onLabel: noop,
};
const render = (props: Partial<LabelingViewProps> = {}) => renderToString(createElement(LabelingView, { ...base, ...props }));

describe("LabelingView", () => {
  it("shows the progress counter as on the spec", () => {
    const html = render();
    expect(html).toContain(ui.labeling.progress("37", "200"));
    expect(html).toContain('aria-valuenow="18"');
  });

  it("gives every post its two label buttons and a clear button, and marks simulated posts", () => {
    const html = render();
    expect(html.split(`>${ui.labeling.setOrganic}</button>`).length - 1).toBe(3);
    expect(html.split(`>${ui.labeling.setAnomalous}</button>`).length - 1).toBe(3);
    expect(html).toContain(ui.labeling.clear);
    expect(html.match(/DATA SIMULASI/g)?.length).toBe(2);
  });

  it("escapes post text instead of rendering it as HTML", () => {
    const html = render();
    expect(html).toContain("&lt;b&gt;bukan HTML&lt;/b&gt;");
    expect(html).not.toContain("<b>bukan HTML</b>");
  });

  it("disables the button of the current label and keeps label chips free of severity colours", () => {
    const html = render();
    expect(html).toMatch(/aria-pressed="true"[^>]*disabled/);
    expect(html).not.toMatch(/sev-(high|medium|low)/);
  });

  it("says everything is labeled when the unlabeled queue is empty", () => {
    expect(render({ result: LABELING_DONE, status: "unlabeled" })).toContain(ui.labeling.allLabeled);
    expect(render({ result: LABELING_DONE, status: "labeled" })).toContain(ui.labeling.empty);
  });

  it("shows a failed save under its post, plus loading and error states", () => {
    expect(render({ rowError: { id: 302, text: ui.common.actionError } })).toContain(ui.common.actionError);
    expect(render({ result: null, loading: true })).toContain('aria-busy="true"');
    expect(render({ result: null, failed: true })).toContain('role="alert"');
  });
});
