"use client";

import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Section } from "@/components/radar/section";
import { Stat } from "@/components/radar/stat";
import { Waktu } from "@/components/radar/waktu";
import { ErrorState } from "@/components/radar/states";
import { countFlags, type CoordinationResponse } from "@/lib/coordination";
import { formatDecimal } from "@/lib/format";
import { ui } from "@/lib/labels";
import { useApiData } from "@/lib/use-api-data";

const copy = ui.coordination.panel;

/** Clusters of near-identical posts the coordination detector sees in a topic right now. Analysts only. */
export function CoordinationPanel({ id }: { id: number }) {
  const { data, error, reload } = useApiData<CoordinationResponse>(`topics/${id}/coordination`);
  const result = data?.data;

  return (
    <Section title={copy.title} description={copy.intro} icon={<Activity className="size-5 text-brand" aria-hidden="true" />}>
      {error && (
        <div className="mb-4">
          <ErrorState title={ui.common.loadError} onRetry={reload} />
        </div>
      )}

      {result === undefined ? (
        <p className="text-sm text-ink-muted">{ui.loading}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-badge border border-line bg-paper px-2.5 py-1 text-table font-medium text-ink">
              {result.triggered ? (
                <>
                  <AlertTriangle className="size-3.5 text-sev-high" aria-hidden="true" />
                  <span className="text-sev-high">{copy.triggered}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5 text-brand" aria-hidden="true" />
                  <span className="text-brand">{copy.notTriggered}</span>
                </>
              )}
            </span>
            <span className="text-ink-muted">{copy.asOf("")} <Waktu value={result.as_of} /></span>
            <span className="text-ink-muted">
              {copy.window("", "")}: <Waktu value={result.window.from} /> – <Waktu value={result.window.to} />
            </span>
          </div>

          <div className="grid max-w-xl grid-cols-2 gap-4">
            <Stat label={copy.postsInWindow} value={String(result.posts_in_window)} />
            <Stat label={copy.accountsInWindow} value={String(result.accounts_in_window)} />
          </div>

          <p className="text-caption text-ink-muted">
            {copy.thresholds(
              formatDecimal(result.thresholds.similarity_threshold, 0, 2),
              result.thresholds.min_accounts_cluster,
              result.thresholds.coordination_window_minutes,
            )}
          </p>

          {result.truncated && <p className="text-sm text-sev-medium">{copy.truncated}</p>}

          {result.clusters.length === 0 ? (
            <p className="text-sm text-ink-muted">{copy.empty}</p>
          ) : (
            <div className="space-y-5">
              {result.clusters.map((cluster) => {
                const flags = countFlags(cluster.accounts);
                return (
                  <div key={cluster.cluster_id} className="rounded-control border border-line bg-paper p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
                      <strong className="font-semibold text-ink">{copy.cluster(cluster.cluster_id)}</strong>
                      <span className="text-ink-muted">{copy.clusterSummary(cluster.accounts_count, cluster.posts_count)}</span>
                      <span className="font-mono text-caption text-ink-muted">
                        {copy.similarity(formatDecimal(cluster.similarity_min, 2, 2), formatDecimal(cluster.similarity_max, 2, 2))}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-badge border border-line bg-panel px-2 py-0.5 text-caption font-medium text-ink">
                        <span>{cluster.synchronized.is_synchronized ? copy.synchronized : copy.notSynchronized}</span>
                      </span>
                      <span className="text-caption text-ink-muted">
                        {copy.synchronizedDetail(cluster.synchronized.posts_in_window, cluster.posts_count, cluster.synchronized.window_minutes)}
                      </span>
                    </div>

                    <p className="mb-2 text-table text-ink">
                      <span className="text-ink-muted">{copy.sampleText}:</span>{" "}
                      <span className="break-words font-mono text-caption text-ink bg-panel p-1 rounded-control border border-line inline-block">
                        {cluster.sample_text}
                      </span>
                    </p>

                    <p className="mb-2 text-caption text-ink-muted">
                      {copy.accountsShown(cluster.accounts.length, cluster.accounts_count)} · {copy.young}: {flags.young} · {copy.sync}: {flags.synchronized}
                    </p>

                    <div className="overflow-x-auto rounded-control border border-line bg-panel">
                      <table className="w-full border-collapse text-left text-table">
                        <thead className="border-b border-line bg-paper text-ink-muted">
                          <tr>
                            <th scope="col" className="h-8 px-3 font-medium">{copy.columns.account}</th>
                            <th scope="col" className="h-8 px-3 font-medium">{copy.columns.similarity}</th>
                            <th scope="col" className="h-8 px-3 font-medium">{copy.columns.age}</th>
                            <th scope="col" className="h-8 px-3 font-medium">{copy.columns.flags}</th>
                            <th scope="col" className="h-8 px-3 font-medium">{copy.columns.posts}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {cluster.accounts.map((account) => (
                            <tr key={account.id} className="h-8 hover:bg-hover">
                              <td className="px-3 font-mono text-caption text-ink">{account.handle ? `@${account.handle}` : ui.common.none}</td>
                              <td className="px-3 font-mono text-caption tabular-nums text-ink">{formatDecimal(account.similarity, 2, 2)}</td>
                              <td className="px-3 text-caption text-ink-muted">{account.age_days === null ? copy.ageUnknown : copy.ageDays(account.age_days)}</td>
                              <td className="px-3 text-caption">
                                {account.young && (
                                  <span className="mr-1 inline-block rounded-badge border border-sev-medium/30 bg-sev-medium-bg px-1.5 py-0.2 text-[11px] font-semibold text-sev-medium">
                                    {copy.young}
                                  </span>
                                )}
                                {account.synchronized && (
                                  <span className="inline-block rounded-badge border border-line bg-paper px-1.5 py-0.2 text-[11px] font-semibold text-ink-muted">
                                    {copy.sync}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 font-mono text-caption tabular-nums text-ink">{account.posts_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
