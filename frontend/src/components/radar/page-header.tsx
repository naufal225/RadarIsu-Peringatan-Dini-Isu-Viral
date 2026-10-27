import type { ReactNode } from "react";

/** Judul halaman serif 24 (Design System §3.3). */
export function PageHeader({ title, subtitle, meta, actions }: { title: string; subtitle?: string; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-serif text-title font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-ink-muted">{subtitle}</p>}
        {meta && <div className="mt-2 text-table text-ink-muted">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
