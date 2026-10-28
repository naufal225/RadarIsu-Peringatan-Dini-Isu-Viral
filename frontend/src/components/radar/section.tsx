import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Panel putih bergaris, satu level (tidak ada kartu di dalam kartu).
 * `flush`: isi menempel ke tepi panel (untuk tabel), dipisah dari judul dengan garis.
 */
export function Section({
  title,
  description,
  actions,
  flush = false,
  className,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("mb-6 rounded-control border border-line bg-panel", flush ? "overflow-hidden" : "p-5", className)}>
      <div className={cn("flex flex-wrap items-start justify-between gap-3", flush ? "border-b border-line px-5 py-4" : "mb-4")}>
        <div className="min-w-0">
          <h2 className="text-section font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 max-w-3xl text-sm text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
