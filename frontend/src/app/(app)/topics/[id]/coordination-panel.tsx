"use client";

import { DataTable, type DataTableColumn } from "@/components/radar/data-table";
import { Section } from "@/components/radar/section";
import { Stat } from "@/components/radar/stat";
import { Tag } from "@/components/radar/tag";
import { ErrorState } from "@/components/radar/states";
import { Waktu } from "@/components/radar/waktu";
import { countFlags, type CoordinationResponse } from "@/lib/coordination";
import { formatDecimal, formatInteger } from "@/lib/format";
import { ui } from "@/lib/labels";
import { useApiData } from "@/lib/use-api-data";

const copy = ui.coordination.panel;

type Account = CoordinationResponse["data"]["clusters"][number]["accounts"][number];

function accountColumns(): DataTableColumn<Account>[] {
  return [
    { id: "account", header: copy.columns.account, mono: true, cell: (a) => a.handle ?? ui.common.none },
    { id: "similarity", header: copy.columns.similarity, mono: true, cell: (a) => formatDecimal(a.similarity, 2, 2) },
    { id: "age", header: copy.columns.age, cell: (a) => (a.age_days === null ? copy.ageUnknown : copy.ageDays(a.age_days)) },
    {
      id: "flags",
      header: copy.columns.flags,
      cell: (a) => (
        <span className="inline-flex flex-wrap gap-1">
          {a.young && <Tag tone="warn">{copy.young}</Tag>}
          {a.synchronized && <Tag tone="muted">{copy.sync}</Tag>}
        </span>
      ),
    },
    { id: "posts", header: copy.columns.posts, mono: true, align: "right", cell: (a) => formatInteger(a.posts_count) },
  ];
}

/** Klaster posting yang hampir identik yang sedang terdeteksi di topik ini. Hanya analis. */
export function CoordinationPanel({ id }: { id: number }) {
  const { data, error, reload } = useApiData<CoordinationResponse>(`topics/${id}/coordination`);
  const result = data?.data;

  return (
    <Section title={copy.title} description={copy.intro}>
      {error ? (
        <ErrorState onRetry={reload} />
      ) : result === undefined ? (
        <p className="text-table text-ink-muted">{ui.loading}</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 text-table">
            <Tag tone={result.triggered ? "danger" : "neutral"}>{result.triggered ? copy.triggered : copy.notTriggered}</Tag>
            <span className="text-ink-muted">
              {copy.asOfPrefix} <Waktu value={result.as_of} />
            </span>
            <span className="text-ink-muted">
              {copy.windowFrom} <Waktu value={result.window.from} /> {copy.windowTo} <Waktu value={result.window.to} />
            </span>
          </div>

          <div className="grid max-w-xl gap-4 sm:grid-cols-2">
            <Stat label={copy.postsInWindow} value={formatInteger(result.posts_in_window)} />
            <Stat label={copy.accountsInWindow} value={formatInteger(result.accounts_in_window)} />
          </div>

          <p className="text-caption text-ink-muted">
            {copy.thresholds(
              formatDecimal(result.thresholds.similarity_threshold, 0, 2),
              result.thresholds.min_accounts_cluster,
              result.thresholds.coordination_window_minutes,
            )}
          </p>
          {result.truncated && <p className="text-table text-sev-medium">{copy.truncated}</p>}

          {result.clusters.length === 0 ? (
            <p className="text-table text-ink-muted">{copy.empty}</p>
          ) : (
            result.clusters.map((cluster) => {
              const flags = countFlags(cluster.accounts);
              return (
                <div key={cluster.cluster_id} className="space-y-3 rounded-control border border-line p-4">
                  <div className="flex flex-wrap items-center gap-3 text-table">
                    <strong className="text-ink">{copy.cluster(cluster.cluster_id)}</strong>
                    <span className="text-ink">{copy.clusterSummary(cluster.accounts_count, cluster.posts_count)}</span>
                    <span className="text-ink-muted">
                      {copy.similarity(formatDecimal(cluster.similarity_min, 2, 2), formatDecimal(cluster.similarity_max, 2, 2))}
                    </span>
                    <Tag tone={cluster.synchronized.is_synchronized ? "danger" : "muted"}>
                      {cluster.synchronized.is_synchronized ? copy.synchronized : copy.notSynchronized}
                    </Tag>
                    <span className="text-caption text-ink-muted">
                      {copy.synchronizedDetail(cluster.synchronized.posts_in_window, cluster.posts_count, cluster.synchronized.window_minutes)}
                    </span>
                  </div>

                  <p className="text-caption text-ink-muted">
                    {copy.sampleText}: <span className="break-words text-ink">{cluster.sample_text}</span>
                  </p>
                  <p className="text-caption text-ink-muted">
                    {copy.accountsShown(cluster.accounts.length, cluster.accounts_count)} · {copy.young}: {flags.young} · {copy.sync}:{" "}
                    {flags.synchronized}
                  </p>

                  <DataTable caption={copy.cluster(cluster.cluster_id)} columns={accountColumns()} rows={cluster.accounts} getRowKey={(a) => a.id} framed={false} />
                </div>
              );
            })
          )}
        </div>
      )}
    </Section>
  );
}
