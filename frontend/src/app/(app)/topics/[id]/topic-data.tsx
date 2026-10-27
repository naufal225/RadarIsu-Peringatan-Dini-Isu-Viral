"use client";

import { useState } from "react";
import { TopicDetailView } from "@/components/topics/topic-detail-view";
import type { MetricsResponse, SpikeBaselineResponse, TopicList } from "@/lib/api-types/topics";
import type { MetricsRange } from "@/lib/topics";
import { useApiData } from "@/lib/use-api-data";

/** Pengambil data /topics/[id]. Metrik memakai rentang bawaan API (7 hari data terakhir); 24 jam memotongnya. */
export function TopicData({ id }: { id: number }) {
  const [range, setRange] = useState<MetricsRange>("7d");
  const topics = useApiData<TopicList>("topics");
  const metrics = useApiData<MetricsResponse>(`topics/${id}/metrics`);
  const spike = useApiData<SpikeBaselineResponse>(`topics/${id}/spike-baseline?hours=24`);

  const topic = topics.data ? (topics.data.data.find((t) => t.id === id) ?? undefined) : null;
  // GET /topics/{id}/metrics menjawab 404 untuk topik yang tidak ada: tampil netral.
  const missing = topic === undefined || metrics.status === 404;

  return (
    <TopicDetailView
      topicId={id}
      topic={missing ? undefined : topic}
      metrics={metrics.data}
      metricsLoading={metrics.loading}
      metricsFailed={metrics.error && metrics.data === null}
      onRetryMetrics={metrics.reload}
      spike={spike.data}
      range={range}
      onRangeChange={setRange}
    />
  );
}
