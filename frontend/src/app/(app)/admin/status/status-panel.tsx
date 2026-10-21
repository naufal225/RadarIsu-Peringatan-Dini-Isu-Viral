"use client";

import { ErrorText, PageTitle, Section, StatusBadge, Table, Td } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { sourceStatusLabels, sourceTypeLabels, ui } from "@/lib/labels";
import { useApiData } from "@/lib/use-api-data";

type Status = {
  sources: {
    id: number;
    type: keyof typeof sourceTypeLabels;
    name: string;
    is_active: boolean;
    last_status: keyof typeof sourceStatusLabels;
    last_fetched_at: string | null;
    last_error: string | null;
  }[];
  queue: {
    pending_jobs: number;
    failed_jobs: number;
    recent_failures: { id: number; job: string | null; error: string; failed_at: string }[];
  };
  counts: { raw_items: number; unprocessed_raw_items: number; posts: number; open_alerts: number };
  offline_mode: boolean;
};

export function StatusPanel() {
  const { data, error } = useApiData<{ data: Status }>("system/status");
  const status = data?.data ?? null;

  return (
    <>
      <PageTitle>{ui.adminStatus.title}</PageTitle>
      <ErrorText>{error ? ui.common.loadError : null}</ErrorText>
      {status === null ? (
        !error && <p className="text-sm text-neutral-500">{ui.loading}</p>
      ) : (
        <>
          <p className="mb-6 text-sm">
            {ui.adminStatus.offlineMode}:{" "}
            <StatusBadge tone={status.offline_mode ? "error" : "muted"}>
              {status.offline_mode ? ui.common.active : ui.common.inactive}
            </StatusBadge>
          </p>

          <Section title={ui.adminStatus.counts}>
            <dl className="grid max-w-xl grid-cols-2 gap-y-1 text-sm">
              <dt className="text-neutral-500">{ui.adminStatus.rawItems}</dt>
              <dd>{status.counts.raw_items}</dd>
              <dt className="text-neutral-500">{ui.adminStatus.unprocessedRawItems}</dt>
              <dd>{status.counts.unprocessed_raw_items}</dd>
              <dt className="text-neutral-500">{ui.adminStatus.posts}</dt>
              <dd>{status.counts.posts}</dd>
              <dt className="text-neutral-500">{ui.adminStatus.openAlerts}</dt>
              <dd>{status.counts.open_alerts}</dd>
            </dl>
          </Section>

          <Section title={ui.adminStatus.sources}>
            {status.sources.length === 0 ? (
              <p className="text-sm text-neutral-500">{ui.common.empty}</p>
            ) : (
              <Table head={[ui.sources.name, ui.sources.type, ui.sources.status, ui.sources.lastChecked, ui.sources.lastError]}>
                {status.sources.map((s) => (
                  <tr key={s.id}>
                    <Td>
                      {s.name} {!s.is_active && <StatusBadge tone="muted">{ui.common.inactive}</StatusBadge>}
                    </Td>
                    <Td>{sourceTypeLabels[s.type]}</Td>
                    <Td>
                      <StatusBadge tone={s.last_status === "ok" ? "ok" : s.last_status === "error" ? "error" : "muted"}>
                        {sourceStatusLabels[s.last_status]}
                      </StatusBadge>
                    </Td>
                    <Td>{formatDateTime(s.last_fetched_at)}</Td>
                    <Td className="max-w-md break-words text-red-700">{s.last_error ?? ui.common.none}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>

          <Section title={ui.adminStatus.queue}>
            <p className="mb-2 text-sm">
              {ui.adminStatus.pendingJobs}: {status.queue.pending_jobs} · {ui.adminStatus.failedJobs}:{" "}
              {status.queue.failed_jobs}
            </p>
            {status.queue.recent_failures.length > 0 && (
              <Table head={[ui.audit.time, ui.adminStatus.recentFailures, ""]}>
                {status.queue.recent_failures.map((f) => (
                  <tr key={f.id}>
                    <Td className="whitespace-nowrap">{formatDateTime(f.failed_at)}</Td>
                    <Td className="font-mono text-xs">{f.job ?? ui.common.none}</Td>
                    <Td className="break-words text-red-700">{f.error}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>
        </>
      )}
    </>
  );
}
