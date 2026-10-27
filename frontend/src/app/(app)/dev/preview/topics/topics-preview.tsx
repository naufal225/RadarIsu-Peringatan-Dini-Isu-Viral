"use client";

import { useState } from "react";
import { PageHeader } from "@/components/radar/page-header";
import { TopicDetailView, type TopicDetailViewProps } from "@/components/topics/topic-detail-view";
import { TopicsView, type TopicFormState, type TopicFormValues, type TopicsViewProps } from "@/components/topics/topics-view";
import { METRICS, METRICS_EMPTY, OFFICIAL_ACCOUNTS, SPIKE, SPIKE_LEARNING, TOPICS } from "@/fixtures/topics";
import { ui } from "@/lib/labels";
import type { MetricsRange } from "@/lib/topics";

const noop = () => undefined;
const EMPTY: TopicFormValues = { name: "", category: "general", sensitivity: "medium", keywordsText: "", is_active: true };
const CLOSED: TopicFormState = { open: false, topicId: null, values: EMPTY, errors: {}, pending: false, failed: false };

const LIST: TopicsViewProps = {
  result: { data: TOPICS },
  loading: false,
  failed: false,
  onRetry: noop,
  canManage: true,
  onCreate: noop,
  onEdit: noop,
  onToggle: noop,
  rowError: null,
  form: CLOSED,
  onFormChange: noop,
  onFormSubmit: noop,
  onFormClose: noop,
  officials: { result: { data: OFFICIAL_ACCOUNTS }, failed: false, addErrors: {}, addPending: false, confirming: null, removing: false },
  onAddOfficial: noop,
  onAskRemoveOfficial: noop,
  onCancelRemoveOfficial: noop,
  onConfirmRemoveOfficial: noop,
};

const DETAIL: TopicDetailViewProps = {
  topicId: 4,
  topic: TOPICS[0],
  metrics: METRICS,
  metricsLoading: false,
  metricsFailed: false,
  spike: SPIKE,
  range: "7d",
  onRangeChange: noop,
};

/**
 * /dev/preview/topics: daftar (interaktif: "Pakai templat" lalu Simpan memunculkan 422 kata kunci templat)
 * dan detail (interaktif: rentang 24 jam/7 hari), plus state lain.
 */
export function TopicsPreview() {
  const [form, setForm] = useState<TopicFormState>(CLOSED);
  const [range, setRange] = useState<MetricsRange>("7d");

  return (
    <>
      <PageHeader title={ui.preview.title(ui.topics.title)} subtitle={ui.preview.subtitle} />

      <section className="mb-12 border-t border-line pt-6">
        <h2 className="mb-4 text-section font-semibold text-ink-muted">{ui.preview.normal}</h2>
        <TopicsView
          {...LIST}
          form={form}
          onCreate={(template) =>
            setForm({ ...CLOSED, open: true, values: template ? { name: template.name, category: template.category, sensitivity: template.sensitivity, keywordsText: template.keywords.join("\n"), is_active: true } : EMPTY })
          }
          onFormChange={(values) => setForm((f) => ({ ...f, values }))}
          onFormSubmit={() => setForm((f) => ({ ...f, errors: (f.values.keywordsText.includes("[") ? { "keywords.0": ["keyword_has_placeholder"] } : {}) as Record<string, string[]> }))}
          onFormClose={() => setForm(CLOSED)}
          officials={{ ...LIST.officials, confirming: null }}
        />
      </section>

      <section className="mb-12 border-t border-line pt-6">
        <h2 className="mb-4 text-section font-semibold text-ink-muted">{ui.preview.empty}</h2>
        <TopicsView {...LIST} result={{ data: [] }} officials={{ ...LIST.officials, result: { data: [] } }} canManage={false} />
      </section>

      <section className="mb-12 border-t border-line pt-6">
        <h2 className="mb-4 text-section font-semibold text-ink-muted">{`${ui.preview.normal} · ${ui.topics.detail.chartTitle}`}</h2>
        <TopicDetailView {...DETAIL} range={range} onRangeChange={setRange} />
      </section>

      {[
        { title: `${ui.preview.empty} · ${ui.detection.spike.insufficient(9, 24)}`, props: { metrics: METRICS_EMPTY, spike: SPIKE_LEARNING } },
        { title: ui.preview.loading, props: { metrics: null, metricsLoading: true, spike: null } },
        { title: ui.preview.error, props: { metrics: null, metricsFailed: true, spike: null } },
        { title: "404", props: { topic: undefined } },
      ].map(({ title, props }) => (
        <section key={title} className="mb-12 border-t border-line pt-6">
          <h2 className="mb-4 text-section font-semibold text-ink-muted">{title}</h2>
          <TopicDetailView {...DETAIL} {...props} />
        </section>
      ))}
    </>
  );
}
