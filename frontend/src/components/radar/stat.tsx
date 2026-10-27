import type { ReactNode } from "react";

/** Angka besar polos di panel, bukan kartu berwarna (Design System §2 #2). */
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-control border border-line bg-panel p-5">
      <div className="text-table text-ink-muted">{label}</div>
      <div className="mt-1 text-metric font-semibold tabular-nums text-ink">{value}</div>
      {hint && <div className="mt-1 text-caption text-ink-muted">{hint}</div>}
    </div>
  );
}
