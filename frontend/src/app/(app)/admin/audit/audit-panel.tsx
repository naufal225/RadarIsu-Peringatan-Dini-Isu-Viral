"use client";

import { useState, type FormEvent } from "react";
import { Button, ErrorText, Field, inputClass, PageTitle, Table, Td } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { auditActionLabels, ui } from "@/lib/labels";
import { useApiData } from "@/lib/use-api-data";

type AuditAction = keyof typeof auditActionLabels;

type AuditEntry = {
  id: number;
  action: AuditAction;
  object_type: string | null;
  object_id: number | null;
  detail: Record<string, unknown>;
  ip_address: string;
  created_at: string;
  user: { id: number; name: string } | null;
};

type Page = { data: AuditEntry[]; meta: { current_page: number; last_page: number; total: number } };

type Filters = { user_id: string; action: string; from: string; to: string };

const EMPTY: Filters = { user_id: "", action: "", from: "", to: "" };

export function AuditPanel() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);

  const query = new URLSearchParams({ page: String(page) });
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  const { data: result, error } = useApiData<Page>(`audit-logs?${query}`);

  // Only for the filter dropdown; the audit list works without it.
  const users = useApiData<{ data: { id: number; name: string }[] }>("users?per_page=100").data?.data ?? [];

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPage(1);
    setFilters({
      user_id: String(data.get("user_id") ?? ""),
      action: String(data.get("action") ?? ""),
      from: String(data.get("from") ?? ""),
      to: String(data.get("to") ?? ""),
    });
  }

  return (
    <>
      <PageTitle>{ui.audit.title}</PageTitle>

      <form onSubmit={applyFilters} aria-label="Filter Audit Log" className="mb-4 grid gap-3 sm:grid-cols-5 sm:items-end">
        <Field label={ui.audit.user}>
          <select name="user_id" defaultValue="" className={inputClass}>
            <option value="">{ui.audit.allUsers}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={ui.audit.action}>
          <select name="action" defaultValue="" className={inputClass}>
            <option value="">{ui.audit.allActions}</option>
            {Object.entries(auditActionLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={ui.audit.from}>
          <input name="from" type="date" className={inputClass} />
        </Field>
        <Field label={ui.audit.to}>
          <input name="to" type="date" className={inputClass} />
        </Field>
        <Button type="submit" variant="primary">
          {ui.audit.filter}
        </Button>
      </form>

      <ErrorText>{error ? ui.common.loadError : null}</ErrorText>

      {result === null ? (
        <p className="text-sm text-neutral-500">{ui.loading}</p>
      ) : result.data.length === 0 ? (
        <p className="text-sm text-neutral-500">{ui.common.empty}</p>
      ) : (
        <>
          <Table head={[ui.audit.time, ui.audit.user, ui.audit.action, ui.audit.object, ui.audit.ip, ui.audit.detail]}>
            {result.data.map((entry) => (
              <tr key={entry.id}>
                <Td className="whitespace-nowrap">{formatDateTime(entry.created_at)}</Td>
                <Td>{entry.user?.name ?? ui.audit.system}</Td>
                <Td>{auditActionLabels[entry.action] ?? entry.action}</Td>
                <Td>{entry.object_type ? `${entry.object_type} #${entry.object_id}` : ui.common.none}</Td>
                <Td className="font-mono text-xs">{entry.ip_address}</Td>
                <Td className="max-w-md break-words font-mono text-xs">
                  {Object.keys(entry.detail).length ? JSON.stringify(entry.detail) : ui.common.none}
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
            <Button disabled={result.meta.current_page >= result.meta.last_page} onClick={() => setPage((p) => p + 1)}>
              {ui.common.next}
            </Button>
          </div>
        </>
      )}
    </>
  );
}
