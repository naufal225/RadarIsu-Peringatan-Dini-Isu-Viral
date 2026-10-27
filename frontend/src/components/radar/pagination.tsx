import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatInteger } from "@/lib/format";
import { ui } from "@/lib/labels";
import { Button } from "./button";

/** Paginasi dilakukan server; komponen ini hanya menampilkan dan meminta halaman. */
export function Pagination({ page, perPage, total, onPageChange }: { page: number; perPage: number; total: number; onPageChange: (page: number) => void }) {
  const last = Math.max(1, Math.ceil(total / Math.max(1, perPage)));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);

  return (
    <nav aria-label={ui.pagination.label} className="mt-3 flex flex-wrap items-center justify-between gap-3 text-table text-ink-muted">
      <span>{ui.pagination.summary(formatInteger(from), formatInteger(to), formatInteger(total))}</span>
      <span className="flex items-center gap-2">
        <Button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft aria-hidden="true" className="size-4" />
          {ui.pagination.previous}
        </Button>
        <span aria-current="page">{ui.pagination.page(page, last)}</span>
        <Button disabled={page >= last} onClick={() => onPageChange(page + 1)}>
          {ui.pagination.next}
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </span>
    </nav>
  );
}
