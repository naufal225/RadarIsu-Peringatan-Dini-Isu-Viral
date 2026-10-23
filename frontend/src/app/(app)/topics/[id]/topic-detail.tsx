"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, ErrorText, Field, inputClass, PageTitle, Section, StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { sensitivityLabels, topicCategoryLabels, ui } from "@/lib/labels";
import { fillHours, summarize, type MetricsResponse, type Topic } from "@/lib/topics";
import { useApiData } from "@/lib/use-api-data";
import { MetricsChart } from "./metrics-chart";

const copy = ui.topics.detail;

const MAX_RANGE_DAYS = 31;

type Range = { from: string; to: string };

/** Inclusive number of days of a Y-m-d range, or null when either side is missing or invalid. */
function rangeDays({ from, to }: Range): number | null {
  if (!from || !to) return null;
  return Math.floor((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
}

const rangeProblem = (range: Range): boolean => {
  const days = rangeDays(range);
  return days !== null && (days < 1 || days > MAX_RANGE_DAYS);
};

export function TopicDetail({ id }: { id: number }) {
  const topics = useApiData<{ data: Topic[] }>("topics");
  const [applied, setApplied] = useState<Range>({ from: "", to: "" });
  const [draft, setDraft] = useState<Range>({ from: "", to: "" });

  const query = new URLSearchParams();
  if (applied.from) query.set("from", applied.from);
  if (applied.to) query.set("to", applied.to);
  const metrics = useApiData<MetricsResponse>(`topics/${id}/metrics${query.size > 0 ? `?${query}` : ""}`);

  const topic = topics.data?.data.find((candidate) => candidate.id === id) ?? null;
  const rows = metrics.data ? fillHours(metrics.data.data, metrics.data.meta.from, metrics.data.meta.to) : null;
  const summary = metrics.data ? summarize(metrics.data.data) : null;

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApplied(draft);
  }

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/topics" className="underline">
          {copy.back}
        </Link>
      </p>

      {topics.data && topic === null ? (
        <PageTitle>{copy.notFound}</PageTitle>
      ) : (
        <>
          <PageTitle>{topic?.name ?? ui.loading}</PageTitle>
          {topic && (
            <p className="mb-4 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
              <span>{topicCategoryLabels[topic.category]}</span>
              <span>·</span>
              <span>{sensitivityLabels[topic.sensitivity]}</span>
              <StatusBadge tone={topic.is_active ? "ok" : "muted"}>{topic.is_active ? ui.common.active : ui.common.inactive}</StatusBadge>
              <span>·</span>
              <span>{topic.keywords.join(", ")}</span>
            </p>
          )}
        </>
      )}

      <ErrorText>{topics.error || metrics.error ? ui.common.loadError : null}</ErrorText>

      <Section title={copy.chartTitle}>
        <form onSubmit={apply} className="mb-4 flex flex-wrap items-end gap-3">
          <Field label={copy.from}>
            <input type="date" name="from" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className={inputClass} />
          </Field>
          <Field label={copy.to}>
            <input type="date" name="to" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className={inputClass} />
          </Field>
          <Button type="submit" variant="primary" disabled={rangeProblem(draft)}>
            {copy.apply}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setDraft({ from: "", to: "" });
              setApplied({ from: "", to: "" });
            }}
          >
            {copy.reset}
          </Button>
        </form>
        {rangeProblem(draft) && <ErrorText>{ui.topics.errors.range_too_long}</ErrorText>}

        {metrics.data && rows && summary ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
              {metrics.data.meta.has_simulated_data && <StatusBadge tone="warn">{ui.simulatedData}</StatusBadge>}
              <span className="text-neutral-600">
                {copy.range(formatDateTime(metrics.data.meta.from), formatDateTime(metrics.data.meta.to))}
              </span>
            </div>

            <dl className="mb-4 grid max-w-3xl gap-3 text-sm sm:grid-cols-3">
              <Stat label={copy.totalPosts} value={String(summary.totalVolume)} />
              <Stat
                label={copy.peakHour}
                value={summary.peak ? `${formatDateTime(summary.peak.hour)} (${summary.peak.volume})` : ui.common.none}
              />
              <Stat label={copy.hoursWithData} value={String(summary.hoursWithData)} />
            </dl>

            {summary.totalVolume === 0 ? <p className="text-sm text-neutral-500">{copy.empty}</p> : <MetricsChart rows={rows} />}
          </>
        ) : (
          <p className="text-sm text-neutral-500">{ui.loading}</p>
        )}
      </Section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 px-3 py-2">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
