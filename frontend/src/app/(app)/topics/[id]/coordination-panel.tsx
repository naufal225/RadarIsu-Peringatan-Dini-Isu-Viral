"use client";

import { ErrorText, Section, StatusBadge, Table, Td } from "@/components/ui";
import { countFlags, type CoordinationResponse } from "@/lib/coordination";
import { formatDateTime, formatDecimal } from "@/lib/format";
import { ui } from "@/lib/labels";
import { useApiData } from "@/lib/use-api-data";

const copy = ui.coordination.panel;

/** Clusters of near-identical posts the coordination detector sees in a topic right now. Analysts only. */
export function CoordinationPanel({ id }: { id: number }) {
  const { data, error } = useApiData<CoordinationResponse>(`topics/${id}/coordination`);
  const result = data?.data;

  return (
    <Section title={copy.title}>
      <p className="mb-3 max-w-3xl text-sm text-ink-muted">{copy.intro}</p>
      <ErrorText>{error ? ui.common.loadError : null}</ErrorText>

      {result === undefined ? (
        <p className="text-sm text-ink-muted">{ui.loading}</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <StatusBadge tone={result.triggered ? "error" : "ok"}>{result.triggered ? copy.triggered : copy.notTriggered}</StatusBadge>
            <span className="text-ink-muted">{copy.asOf(formatDateTime(result.as_of))}</span>
            <span className="text-ink-muted">{copy.window(formatDateTime(result.window.from), formatDateTime(result.window.to))}</span>
          </div>

          <dl className="mb-3 grid max-w-xl gap-3 text-sm sm:grid-cols-2">
            <Stat label={copy.postsInWindow} value={String(result.posts_in_window)} />
            <Stat label={copy.accountsInWindow} value={String(result.accounts_in_window)} />
          </dl>
          <p className="mb-3 text-xs text-ink-muted">
            {copy.thresholds(
              formatDecimal(result.thresholds.similarity_threshold, 0, 2),
              result.thresholds.min_accounts_cluster,
              result.thresholds.coordination_window_minutes,
            )}
          </p>
          {result.truncated && <p className="mb-3 text-sm text-sev-medium">{copy.truncated}</p>}

          {result.clusters.length === 0 ? (
            <p className="text-sm text-ink-muted">{copy.empty}</p>
          ) : (
            <div className="space-y-6">
              {result.clusters.map((cluster) => {
                const flags = countFlags(cluster.accounts);
                return (
                  <div key={cluster.cluster_id} className="rounded-md border border-line p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
                      <strong>{copy.cluster(cluster.cluster_id)}</strong>
                      <span>{copy.clusterSummary(cluster.accounts_count, cluster.posts_count)}</span>
                      <span className="text-ink-muted">
                        {copy.similarity(formatDecimal(cluster.similarity_min, 2, 2), formatDecimal(cluster.similarity_max, 2, 2))}
                      </span>
                      <StatusBadge tone={cluster.synchronized.is_synchronized ? "error" : "muted"}>
                        {cluster.synchronized.is_synchronized ? copy.synchronized : copy.notSynchronized}
                      </StatusBadge>
                      <span className="text-xs text-ink-muted">
                        {copy.synchronizedDetail(cluster.synchronized.posts_in_window, cluster.posts_count, cluster.synchronized.window_minutes)}
                      </span>
                    </div>
                    <p className="mb-2 text-xs text-ink-muted">
                      {copy.sampleText}: <span className="break-words">{cluster.sample_text}</span>
                    </p>
                    <p className="mb-1 text-xs text-ink-muted">
                      {copy.accountsShown(cluster.accounts.length, cluster.accounts_count)} · {copy.young}: {flags.young} · {copy.sync}: {flags.synchronized}
                    </p>
                    <Table head={[copy.columns.account, copy.columns.similarity, copy.columns.age, copy.columns.flags, copy.columns.posts]}>
                      {cluster.accounts.map((account) => (
                        <tr key={account.id}>
                          <Td className="font-mono text-xs">{account.handle ?? ui.common.none}</Td>
                          <Td>{formatDecimal(account.similarity, 2, 2)}</Td>
                          <Td>{account.age_days === null ? copy.ageUnknown : copy.ageDays(account.age_days)}</Td>
                          <Td>
                            {account.young && <StatusBadge tone="warn">{copy.young}</StatusBadge>}{" "}
                            {account.synchronized && <StatusBadge tone="muted">{copy.sync}</StatusBadge>}
                          </Td>
                          <Td>{account.posts_count}</Td>
                        </tr>
                      ))}
                    </Table>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line px-3 py-2">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
