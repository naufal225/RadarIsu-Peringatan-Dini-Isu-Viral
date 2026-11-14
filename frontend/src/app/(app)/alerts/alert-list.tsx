"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, ErrorText, Field, inputClass, PageTitle, StatusBadge, Table, Td } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { alertKindLabels, alertStatusLabels, severityLabels, ui } from "@/lib/labels";
import { useApiData } from "@/lib/use-api-data";

type AlertItem = {
  id: number;
  kind: keyof typeof alertKindLabels;
  status: keyof typeof alertStatusLabels;
  score: number;
  severity: keyof typeof severityLabels;
  topic: { id: number; name: string } | null;
  subject_account: { id: number; handle: string } | null;
  detected_at: string;
};

type AlertResponse = {
  data: AlertItem[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};

type Filters = {
  status: string;
  severity: string;
  kind: string;
};

const EMPTY_FILTERS: Filters = { status: "", severity: "", kind: "" };

export function AlertList() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const query = new URLSearchParams({ page: String(page) });
  if (filters.status) query.set("status", filters.status);
  if (filters.severity) query.set("severity", filters.severity);
  if (filters.kind) query.set("kind", filters.kind);

  const { data: result, error } = useApiData<AlertResponse>(`alerts?${query}`);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPage(1);
    setFilters({
      status: String(data.get("status") ?? ""),
      severity: String(data.get("severity") ?? ""),
      kind: String(data.get("kind") ?? ""),
    });
  }

  function getSeverityTone(sev: keyof typeof severityLabels): "error" | "ok" | "muted" {
    if (sev === "high") return "error";
    if (sev === "medium") return "muted";
    return "ok";
  }

  function getStatusTone(st: keyof typeof alertStatusLabels): "error" | "ok" | "muted" {
    if (st === "escalated" || st === "new") return "error";
    if (st === "approved") return "ok";
    return "muted";
  }

  return (
    <>
      <PageTitle>{ui.alerts.title}</PageTitle>

      <form onSubmit={applyFilters} className="mb-4 grid gap-3 sm:grid-cols-4 sm:items-end">
        <Field label={ui.alerts.filterStatus}>
          <select name="status" defaultValue={filters.status} className={inputClass}>
            <option value="">{ui.alerts.allStatus}</option>
            {Object.entries(alertStatusLabels).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label={ui.alerts.filterSeverity}>
          <select name="severity" defaultValue={filters.severity} className={inputClass}>
            <option value="">{ui.alerts.allSeverity}</option>
            {Object.entries(severityLabels).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label={ui.alerts.filterKind}>
          <select name="kind" defaultValue={filters.kind} className={inputClass}>
            <option value="">{ui.alerts.allKind}</option>
            {Object.entries(alertKindLabels).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Button type="submit" variant="primary">
          {ui.audit.filter}
        </Button>
      </form>

      <ErrorText>{error ? ui.common.loadError : null}</ErrorText>

      {result === null ? (
        <p className="text-sm text-ink-muted">{ui.loading}</p>
      ) : result.data.length === 0 ? (
        <p className="text-sm text-ink-muted">{ui.common.empty}</p>
      ) : (
        <>
          <Table
            head={[
              ui.alerts.id,
              ui.alerts.topicOrAccount,
              ui.alerts.kind,
              ui.alerts.score,
              ui.alerts.severity,
              ui.alerts.status,
              ui.alerts.detectedAt,
              "",
            ]}
          >
            {result.data.map((alert) => (
              <tr key={alert.id} className="hover:bg-hover">
                <Td className="font-mono text-xs">#{alert.id}</Td>
                <Td className="font-medium">
                  {alert.topic?.name ?? alert.subject_account?.handle ?? ui.common.none}
                </Td>
                <Td>{alertKindLabels[alert.kind] ?? alert.kind}</Td>
                <Td className="font-semibold">{alert.score}</Td>
                <Td>
                  <StatusBadge tone={getSeverityTone(alert.severity)}>
                    {severityLabels[alert.severity] ?? alert.severity}
                  </StatusBadge>
                </Td>
                <Td>
                  <StatusBadge tone={getStatusTone(alert.status)}>
                    {alertStatusLabels[alert.status] ?? alert.status}
                  </StatusBadge>
                </Td>
                <Td className="whitespace-nowrap text-xs text-ink-muted">
                  {formatDateTime(alert.detected_at)}
                </Td>
                <Td className="text-right">
                  <Link
                    href={`/alerts/${alert.id}`}
                    className="inline-block rounded border border-line px-2.5 py-1 text-xs font-medium hover:bg-hover"
                  >
                    {ui.alerts.viewDetail}
                  </Link>
                </Td>
              </tr>
            ))}
          </Table>

          <div className="mt-3 flex items-center gap-3 text-sm">
            <Button disabled={result.meta.current_page <= 1} onClick={() => setPage((p) => p - 1)}>
              {ui.common.previous}
            </Button>
            <span>
              {ui.common.page} {result.meta.current_page} / {result.meta.last_page} · {result.meta.total}
            </span>
            <Button
              disabled={result.meta.current_page >= result.meta.last_page}
              onClick={() => setPage((p) => p + 1)}
            >
              {ui.common.next}
            </Button>
          </div>
        </>
      )}
    </>
  );
}
