"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/labels";
import { EmptyState, ErrorState } from "./states";
import { SkeletonRows } from "./skeleton";
import type { Severity } from "./types";

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  mono?: boolean;
  /** Tailwind width class, e.g. "w-40". */
  width?: string;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string | number;
  /** Makes the first cell a link and the whole row clickable. */
  rowHref?: (row: T) => string;
  /** Left 3 px bar by severity. */
  rowSeverity?: (row: T) => Severity | null;
  /** Selected row: --brand-tint background and a --brand bar on the left (Design System §11). */
  rowSelected?: (row: T) => boolean;
  loading?: boolean;
  /** Shown when `rows` is empty and nothing is loading or failed. */
  empty?: ReactNode;
  error?: { title?: string; description?: string; onRetry?: () => void } | null;
  /** Screen-reader caption describing the table. */
  caption: string;
};

const SEVERITY_BAR: Record<Severity, string> = {
  high: "border-l-sev-high",
  medium: "border-l-sev-medium",
  low: "border-l-sev-low",
};

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const;

/**
 * Tabel padat (baris 40 px). Pengurutan dan paginasi dilakukan server; tabel hanya menampilkan.
 * Kolom pertama menjadi tautan (keyboard) dan seluruh baris bisa diklik bila `rowHref` ada.
 */
export function DataTable<T>({ columns, rows, getRowKey, rowHref, rowSeverity, rowSelected, loading, empty, error, caption }: DataTableProps<T>) {
  const router = useRouter();

  if (error) return <ErrorState {...error} />;
  if (loading) return <SkeletonRows columns={columns.length} />;
  if (rows.length === 0) return <>{empty ?? <EmptyState title={ui.table.empty} />}</>;

  function openRow(event: MouseEvent<HTMLTableRowElement> | KeyboardEvent<HTMLTableRowElement>, href: string) {
    // Klik pada tautan, tombol, atau input di dalam baris tetap milik elemen itu.
    if ((event.target as HTMLElement).closest("a, button, input, select, textarea, summary")) return;
    router.push(href);
  }

  return (
    <div className="overflow-x-auto rounded-control border border-line bg-panel">
      <table className="w-full border-collapse text-left text-table">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line bg-paper text-ink-muted">
          <tr>
            {columns.map((column) => (
              <th key={column.id} scope="col" className={cn("h-10 px-3 font-medium", ALIGN[column.align ?? "left"], column.width)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => {
            const href = rowHref?.(row);
            const severity = rowSeverity?.(row) ?? null;
            const selected = rowSelected?.(row) ?? false;
            return (
              <tr
                key={getRowKey(row)}
                onClick={href ? (event) => openRow(event, href) : undefined}
                aria-selected={rowSelected ? selected : undefined}
                className={cn("h-10", selected ? "bg-brand-tint" : "hover:bg-hover", href && "cursor-pointer")}
              >
                {columns.map((column, index) => {
                  const content = column.cell(row);
                  return (
                    <td
                      key={column.id}
                      className={cn(
                        "px-3 align-middle",
                        ALIGN[column.align ?? "left"],
                        column.mono && "font-mono",
                        index === 0 && "max-md:sticky max-md:left-0 max-md:bg-panel",
                        index === 0 && severity && cn("border-l-3", SEVERITY_BAR[severity]),
                        index === 0 && !severity && selected && "border-l-3 border-l-brand",
                        index === 0 && selected && "max-md:bg-brand-tint",
                      )}
                    >
                      {index === 0 && href ? (
                        <Link href={href} className="font-medium text-brand underline-offset-2 hover:underline">
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
