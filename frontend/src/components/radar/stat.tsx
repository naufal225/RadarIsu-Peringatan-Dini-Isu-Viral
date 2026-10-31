import type { ReactNode } from "react";

/** Angka besar polos di panel, bukan kartu berwarna (Design System §2 #2). */
export function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-control border border-line bg-panel p-5 transition-colors">
      <div className="flex items-center justify-between gap-2 text-table text-ink-muted">
        <span>{label}</span>
        {icon && <div className="shrink-0 text-brand">{icon}</div>}
      </div>
      <div className="mt-2 text-metric font-semibold tabular-nums text-ink">{value}</div>
      {hint && <div className="mt-1.5 text-caption text-ink-muted">{hint}</div>}
    </div>
  );
}
