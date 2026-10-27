"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SignalChart } from "@/components/charts/signal-chart";
import { PageHeader } from "@/components/radar/page-header";
import { Section } from "@/components/radar/section";
import { SimBadge } from "@/components/radar/simulation";
import { Stat } from "@/components/radar/stat";
import { NotAvailable } from "@/components/radar/states";
import { Waktu } from "@/components/radar/waktu";
import type { MetricsResponse, SpikeBaselineResponse, Topic } from "@/lib/api-types/topics";
import { cn } from "@/lib/cn";
import { formatInteger, formatNumber } from "@/lib/format";
import { sensitivityLabels, spikeStatusLabels, topicCategoryLabels, ui } from "@/lib/labels";
import { fillHours, rowsForRange, spikeReference, spikeWindow, summarize, type MetricsRange } from "@/lib/topics";

const copy = ui.topics;
const spikeCopy = ui.detection.spike;

export type TopicDetailViewProps = {
  topicId: number;
  /** null while loading; undefined when the topic list loaded and has no such id (404, shown neutrally). */
  topic: Topic | null | undefined;
  metrics: MetricsResponse | null;
  metricsLoading: boolean;
  metricsFailed: boolean;
  onRetryMetrics?: () => void;
  /** null when the spike endpoint has not answered (or failed): the chart then shows volume only. */
  spike: SpikeBaselineResponse | null;
  range: MetricsRange;
  onRangeChange: (range: MetricsRange) => void;
};

/** Presentasi murni /topics/[id]: header, grafik volume per jam, ringkasan, kata kunci, dan status lonjakan. */
export function TopicDetailView({ topic, metrics, metricsLoading, metricsFailed, onRetryMetrics, spike, range, onRangeChange }: TopicDetailViewProps) {
  if (topic === undefined) return <NotAvailable />;

  const rows = metrics ? rowsForRange(fillHours(metrics.data, metrics.meta.from, metrics.meta.to), range) : [];
  const summary = summarize(rows);
  const snapshot = spike?.data.spike ?? null;
  const reference = snapshot ? spikeReference(snapshot) : {};
  const spikeWin = snapshot && spike ? spikeWindow(snapshot.triggered, spike.data.as_of, snapshot.thresholds.current_window_minutes) : null;

  return (
    <>
      <p className="mb-3 text-table">
        <Link href="/topics" className="inline-flex items-center gap-1 text-brand underline-offset-2 hover:underline">
          <ArrowLeft aria-hidden="true" className="size-4" />
          {copy.detail.back}
        </Link>
      </p>
      <PageHeader
        title={topic?.name ?? ui.loading}
        meta={
          topic && (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{topicCategoryLabels[topic.category]}</span>
              <span>
                {copy.columns.sensitivity}: {sensitivityLabels[topic.sensitivity]}
              </span>
              <span>{topic.is_active ? ui.common.active : ui.common.inactive}</span>
              {metrics?.meta.has_simulated_data && <SimBadge />}
            </span>
          )
        }
      />

      <Section
        title={copy.detail.chartTitle}
        actions={
          <div role="group" aria-label={copy.range.label} className="inline-flex overflow-hidden rounded-control border border-line-input">
            {(["24h", "7d"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={range === option}
                onClick={() => onRangeChange(option)}
                className={cn("h-8 px-3 text-table", range === option ? "bg-brand text-brand-fg" : "bg-panel text-ink hover:bg-hover")}
              >
                {option === "24h" ? copy.range.last24 : copy.range.last7}
              </button>
            ))}
          </div>
        }
      >
        <SignalChart
          // Tanpa satu posting pun di rentang ini: tampilkan "belum ada data", bukan garis nol yang menyesatkan.
          series={summary.totalVolume === 0 ? [] : rows.map((r) => ({ hour: r.hour, volume: r.volume }))}
          baseline={reference.baseline}
          threshold={reference.threshold}
          window={spikeWin ?? undefined}
          loading={metricsLoading && metrics === null}
          error={metricsFailed ? { onRetry: onRetryMetrics } : null}
        />
        {metrics && summary.totalVolume > 0 && (
          <>
            <p className="mt-3 flex flex-wrap items-center gap-1 text-caption text-ink-muted">
              {copy.range.noteLabel} <Waktu value={rows[0].hour} className="text-caption" /> {copy.range.until}{" "}
              <Waktu value={new Date(Date.parse(rows[rows.length - 1].hour) + 3_600_000).toISOString()} className="text-caption" />
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Stat label={copy.detail.totalPosts} value={formatInteger(summary.totalVolume)} />
              <Stat label={copy.detail.peakHour} value={summary.peak ? formatInteger(summary.peak.volume) : ui.common.none} hint={summary.peak ? <Waktu value={summary.peak.hour} className="text-caption" /> : undefined} />
              <Stat label={copy.detail.hoursWithData} value={formatInteger(summary.hoursWithData)} />
            </div>
          </>
        )}
      </Section>

      {topic && (
        <Section title={copy.keywordsTitle}>
          <ul className="flex flex-wrap gap-2">
            {topic.keywords.map((keyword) => (
              <li key={keyword} className="rounded-badge border border-line bg-paper px-2 py-1 font-mono text-table text-ink">
                {keyword}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {snapshot && spike && (
        <Section title={copy.spikeStatus} description={spikeCopy.intro}>
          <p className="mb-3 flex flex-wrap items-center gap-2 text-table">
            <span className={cn("rounded-badge border px-2 py-0.5 font-medium", snapshot.triggered ? "border-sev-high bg-sev-high-bg text-sev-high" : "border-line-input text-ink")}>
              {spikeStatusLabels[snapshot.status]}
            </span>
            <span className="text-ink-muted">{spikeCopy.sensitivity(snapshot.thresholds.sensitivity, formatNumber(snapshot.thresholds.sensitivity_z_offset, 1, 1))}</span>
            <span className="flex items-center gap-1 text-ink-muted">
              <Waktu value={spike.data.as_of} className="text-table" />
            </span>
            {snapshot.triggered && (
              <Link href="/alerts" className="text-brand underline-offset-2 hover:underline">
                {spikeCopy.alertsLink}
              </Link>
            )}
          </p>
          {!snapshot.has_sufficient_baseline && <p className="mb-3 text-sm text-ink-muted">{spikeCopy.insufficient(snapshot.baseline_hours, snapshot.thresholds.min_baseline_hours)}</p>}
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label={spikeCopy.current} value={formatInteger(snapshot.current)} hint={spikeCopy.currentHint(snapshot.thresholds.current_window_minutes)} />
            <Stat label={spikeCopy.baselineMean} value={formatNumber(snapshot.mean, 0, 1)} hint={`${spikeCopy.baselineStd}: ${formatNumber(snapshot.std, 0, 1)}`} />
            <Stat label={spikeCopy.z} value={formatNumber(snapshot.z, 0, 2)} hint={`${spikeCopy.zNeeded}: ${formatNumber(snapshot.z_effective, 0, 2)}`} />
            <Stat label={spikeCopy.threshold} value={snapshot.has_sufficient_baseline ? formatNumber(snapshot.threshold_rate, 0, 1) : ui.common.none} />
            <Stat label={spikeCopy.baselineHours} value={formatInteger(snapshot.baseline_hours)} />
            <Stat label={spikeCopy.minVolume} value={formatInteger(snapshot.thresholds.min_volume)} />
          </div>
        </Section>
      )}
    </>
  );
}
