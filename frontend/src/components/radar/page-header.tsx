import type { ReactNode } from "react";

/** Judul halaman modern sans-serif 24 (Design System §3.3). */
export function PageHeader({
  title,
  subtitle,
  meta,
  actions,
  icon,
}: {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3.5 min-w-0">
        {icon && (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-control bg-brand-tint text-brand mt-0.5">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-sans text-title font-bold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1 max-w-3xl text-sm text-ink-muted">{subtitle}</p>}
          {meta && <div className="mt-2 text-table text-ink-muted">{meta}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
