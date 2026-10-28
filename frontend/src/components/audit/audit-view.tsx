"use client";

import { Fragment } from "react";
import { DataTable, type DataTableColumn } from "@/components/radar/data-table";
import { ClearFilters, FilterBar, FilterField, FilterSelect } from "@/components/radar/filter-bar";
import { controlClass, FieldError } from "@/components/radar/form";
import { PageHeader } from "@/components/radar/page-header";
import { Pagination } from "@/components/radar/pagination";
import { EmptyState } from "@/components/radar/states";
import { Waktu } from "@/components/radar/waktu";
import type { AuditEntry, AuditFilters, AuditPage, UserOption } from "@/lib/api-types/audit";
import { detailSummary, detailText, hasActiveFilters } from "@/lib/audit";
import { formatInteger } from "@/lib/format";
import { auditActionLabels, ui } from "@/lib/labels";
import { auditObjectLabels } from "@/lib/labels/audit";

const copy = ui.audit;

export type AuditViewProps = {
  result: AuditPage | null;
  loading: boolean;
  /** Network or server failure (not 422). */
  failed: boolean;
  onRetry?: () => void;
  users: UserOption[];
  filters: AuditFilters;
  /** 422 messages per filter field. */
  filterErrors: Partial<Record<keyof AuditFilters, string[]>>;
  onFiltersChange: (filters: AuditFilters) => void;
  onPageChange: (page: number) => void;
};

function actionText(action: string): string {
  return (auditActionLabels as Record<string, string>)[action] ?? action;
}

/** Jenis objek berlabel ("Skenario Replay") dengan id mono; jenis yang tidak dikenal tampil sebagai kodenya. */
function ObjectCell({ entry }: { entry: AuditEntry }) {
  if (!entry.object_type) return <span className="text-ink-muted">{copy.noDetail}</span>;
  const label = (auditObjectLabels as Record<string, string>)[entry.object_type];
  return (
    <span className="whitespace-nowrap">
      {label ?? <span className="font-mono">{entry.object_type}</span>}
      {entry.object_id !== null && <span className="ml-1 font-mono text-ink-muted">#{entry.object_id}</span>}
    </span>
  );
}

/**
 * Rincian: ringkasan satu baris langsung terbaca (mis. "escalated → approved"), data lengkap dan peramban
 * di balik <details>. Ditampilkan sebagai teks (React meng-escape), tidak pernah sebagai HTML.
 */
function DetailCell({ entry }: { entry: AuditEntry }) {
  const { parts, more } = detailSummary(entry.detail);
  const text = detailText(entry.detail);
  if (parts.length === 0 && !text && !entry.user_agent) return <span className="text-ink-muted">{copy.noDetail}</span>;

  return (
    <div className="min-w-44 max-w-md py-1.5">
      {parts.length > 0 && (
        <p className="break-words text-ink">
          {/* Satu pasangan tidak terpotong; baris boleh pindah di antara pasangan. */}
          {parts.map((part, index) => (
            <Fragment key={`${part.key}:${index}`}>
              {index > 0 && <span className="text-ink-muted"> · </span>}
              <span className="whitespace-nowrap">
                {part.key && <span className="font-mono text-caption text-ink-muted">{part.key} </span>}
                {part.value}
              </span>
            </Fragment>
          ))}
          {more && <span className="text-caption text-ink-muted"> {copy.moreDetail}</span>}
        </p>
      )}
      <details className="mt-0.5">
        <summary className="cursor-pointer text-caption text-brand underline-offset-2 hover:underline">{copy.showJson}</summary>
        {text && <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-control border border-line bg-paper p-2 font-mono text-caption text-ink">{text}</pre>}
        {entry.user_agent && (
          <p className="mt-1 break-words text-caption text-ink-muted">
            {copy.userAgent}: <span className="font-mono">{entry.user_agent}</span>
          </p>
        )}
      </details>
    </div>
  );
}

const COLUMNS: DataTableColumn<AuditEntry>[] = [
  // Audit wajib menampilkan UTC langsung (docs/UI_PAGES.md), bukan hanya saat hover.
  { id: "time", header: copy.time, cell: (e) => <Waktu value={e.created_at} utc="inline" /> },
  {
    id: "user",
    header: copy.user,
    cell: (e) =>
      e.user ? (
        <>
          <span className="block text-ink">{e.user.name}</span>
          <span className="block font-mono text-caption text-ink-muted">{e.user.email}</span>
        </>
      ) : (
        <span className="text-ink-muted">{copy.system}</span>
      ),
  },
  {
    id: "action",
    header: copy.action,
    cell: (e) => (
      <>
        <span className="block text-ink">{actionText(e.action)}</span>
        <span className="block font-mono text-caption text-ink-muted">{e.action}</span>
      </>
    ),
  },
  { id: "object", header: copy.object, cell: (e) => <ObjectCell entry={e} /> },
  { id: "ip", header: copy.ip, cell: (e) => e.ip_address, mono: true },
  { id: "detail", header: copy.detail, cell: (e) => <DetailCell entry={e} /> },
];

/** Presentasi murni halaman Audit. Tabel append-only: tidak ada tombol ubah atau hapus. */
export function AuditView({ result, loading, failed, onRetry, users, filters, filterErrors, onFiltersChange, onPageChange }: AuditViewProps) {
  const invalid = Object.keys(filterErrors).length > 0;
  const set = (key: keyof AuditFilters) => (value: string) => onFiltersChange({ ...filters, [key]: value });

  return (
    <>
      <PageHeader title={copy.title} subtitle={copy.subtitle} />

      <FilterBar label={copy.filters}>
        <FilterSelect label={copy.user} name="user_id" value={filters.user_id} onChange={set("user_id")} allLabel={copy.allUsers} options={users.map((u) => ({ value: String(u.id), label: u.name }))} />
        <FilterSelect
          label={copy.action}
          name="action"
          value={filters.action}
          onChange={set("action")}
          allLabel={copy.allActions}
          options={Object.entries(auditActionLabels).map(([value, label]) => ({ value, label }))}
        />
        <FilterField label={copy.from} className="w-44">
          <input type="date" name="from" value={filters.from} onChange={(e) => set("from")(e.target.value)} className={controlClass} aria-invalid={!!filterErrors.from} />
          {filterErrors.from && <FieldError>{copy.invalidFilter}</FieldError>}
        </FilterField>
        <FilterField label={copy.to} className="w-44">
          <input type="date" name="to" value={filters.to} onChange={(e) => set("to")(e.target.value)} className={controlClass} aria-invalid={!!filterErrors.to} />
          {filterErrors.to && <FieldError>{copy.invalidRange}</FieldError>}
        </FilterField>
        <ClearFilters active={hasActiveFilters(filters)} onClear={() => onFiltersChange({ user_id: "", action: "", from: "", to: "" })} />
      </FilterBar>

      {!invalid && result && result.data.length > 0 && (
        <p role="status" className="mb-2 text-table text-ink-muted">
          {(hasActiveFilters(filters) ? copy.countFiltered : copy.count)(formatInteger(result.meta.total))}
        </p>
      )}

      {/* Filter tidak valid (422): pesan ada di bawah bidangnya; tabel lama tidak ditampilkan agar tidak menyesatkan. */}
      {invalid ? null : (
      <DataTable
        columns={COLUMNS}
        rows={result?.data ?? []}
        getRowKey={(e) => e.id}
        loading={loading && result === null}
        error={failed ? { onRetry } : null}
        caption={copy.tableCaption}
        empty={<EmptyState title={copy.empty} description={hasActiveFilters(filters) ? copy.emptyHint : undefined} />}
      />
      )}

      {!invalid && result && result.data.length > 0 && (
        <Pagination page={result.meta.current_page} perPage={result.meta.per_page} total={result.meta.total} onPageChange={onPageChange} />
      )}
    </>
  );
}
