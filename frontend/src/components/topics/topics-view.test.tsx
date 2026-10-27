import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/topics" }));

import { METRICS, METRICS_EMPTY, OFFICIAL_ACCOUNTS, SPIKE, SPIKE_LEARNING, TOPICS } from "@/fixtures/topics";
import { ui } from "@/lib/labels";
import { fillHours, rowsForRange, spikeReference, spikeWindow } from "@/lib/topics";
import { TopicDetailView, type TopicDetailViewProps } from "./topic-detail-view";
import { TopicsView, type TopicFormState, type TopicsViewProps } from "./topics-view";

const noop = () => undefined;
const closed: TopicFormState = { open: false, topicId: null, values: { name: "", category: "general", sensitivity: "medium", keywordsText: "", is_active: true }, errors: {}, pending: false, failed: false };
const list: TopicsViewProps = {
  result: { data: TOPICS },
  loading: false,
  failed: false,
  canManage: true,
  onCreate: noop,
  onEdit: noop,
  onToggle: noop,
  rowError: null,
  form: closed,
  onFormChange: noop,
  onFormSubmit: noop,
  onFormClose: noop,
  officials: { result: { data: OFFICIAL_ACCOUNTS }, failed: false, addErrors: {}, addPending: false, confirming: null, removing: false },
  onAddOfficial: noop,
  onAskRemoveOfficial: noop,
  onCancelRemoveOfficial: noop,
  onConfirmRemoveOfficial: noop,
};
const detail: TopicDetailViewProps = { topicId: 4, topic: TOPICS[0], metrics: METRICS, metricsLoading: false, metricsFailed: false, spike: SPIKE, range: "7d", onRangeChange: noop };
const renderList = (p: Partial<TopicsViewProps> = {}) => renderToString(createElement(TopicsView, { ...list, ...p }));
const renderDetail = (p: Partial<TopicDetailViewProps> = {}) => renderToString(createElement(TopicDetailView, { ...detail, ...p }));

describe("topic helpers", () => {
  it("cuts the last 24 hours from the default 7 days without inventing rows", () => {
    const rows = fillHours(METRICS.data, METRICS.meta.from, METRICS.meta.to);
    expect(rows).toHaveLength(168);
    expect(rowsForRange(rows, "24h")).toEqual(rows.slice(-24));
    expect(rowsForRange(rows, "7d")).toBe(rows);
  });

  it("uses the server's baseline and threshold only when the baseline is long enough", () => {
    expect(spikeReference(SPIKE.data.spike)).toEqual({ baseline: { mean: 12.4, std: 3.6 }, threshold: 21.4 });
    expect(spikeReference(SPIKE_LEARNING.data.spike)).toEqual({});
  });

  it("highlights the detector's window only when it fired", () => {
    expect(spikeWindow(true, "2026-10-27T08:00:00Z", 60)).toEqual({ start: "2026-10-27T07:00:00.000Z", end: "2026-10-27T08:00:00.000Z" });
    expect(spikeWindow(false, "2026-10-27T08:00:00Z", 60)).toBeNull();
  });
});

describe("TopicsView", () => {
  it("links each topic to its detail and keeps templates apart", () => {
    const html = renderList();
    expect(html).toContain('href="/topics/4"');
    expect(html).toContain(ui.topics.templatesTitle);
    expect(html).toContain(ui.topics.list.keywordCount(3));
  });

  it("marks template placeholders and shows the 422 under the keywords field", () => {
    const html = renderList({ form: { ...closed, open: true, values: { ...closed.values, name: "Isu", keywordsText: "[nama satuan]" }, errors: { "keywords.0": ["keyword_has_placeholder"] } } });
    expect(html).toContain(ui.topics.errors.keyword_has_placeholder);
    expect(html).toContain("border-dashed");
  });

  it("hides create, edit, template use, and official-account changes without topics.manage", () => {
    const html = renderList({ canManage: false });
    for (const text of [ui.topics.list.create, `>${ui.topics.edit}</button>`, `>${ui.topics.useTemplate}</button>`, ui.topics.officialAccounts.add]) expect(html).not.toContain(text);
  });

  it("puts removing an official account behind a confirmation", () => {
    expect(renderList()).toContain("<dialog");
  });
});

describe("TopicDetailView", () => {
  it("draws the server baseline and threshold and lists the keywords", () => {
    const html = renderDetail();
    expect(html).toContain(ui.chart.referenceBaseline);
    expect(html).toContain(ui.chart.threshold);
    expect(html).toContain("antrean loket");
    expect(html).toContain("DATA SIMULASI");
  });

  it("falls back to volume only, labelled honestly, while the baseline is too short", () => {
    const html = renderDetail({ spike: SPIKE_LEARNING });
    expect(html).toContain(ui.chart.referenceRange);
    expect(html).not.toContain(ui.chart.threshold);
    expect(html).toContain(ui.detection.spike.insufficient(9, 24));
  });

  it("says there is no data, shows loading and errors, and a neutral 404", () => {
    expect(renderDetail({ metrics: METRICS_EMPTY })).toContain(ui.chart.empty);
    expect(renderDetail({ metrics: null, metricsLoading: true })).toContain('aria-busy="true"');
    expect(renderDetail({ metrics: null, metricsFailed: true })).toContain('role="alert"');
    expect(renderDetail({ topic: undefined })).toContain(ui.state.notAvailableTitle);
  });

  it("offers the 24 hour and 7 day ranges", () => {
    const html = renderDetail();
    expect(html).toContain(ui.topics.range.last24);
    expect(html).toContain(ui.topics.range.last7);
  });
});
