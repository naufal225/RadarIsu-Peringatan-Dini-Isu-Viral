import { cn } from "@/lib/cn";

const PULSE = "motion-safe:animate-pulse bg-brand-tint";

function Bar({ className }: { className?: string }) {
  return <div className={cn("h-3 rounded-badge", PULSE, className)} />;
}

/** Placeholder baris tabel; bentuknya menyerupai isi, bukan spinner layar penuh. */
export function SkeletonRows({ rows = 5, columns = 4, framed = true }: { rows?: number; columns?: number; framed?: boolean }) {
  return (
    <div role="status" aria-busy="true" className={cn("divide-y divide-line bg-panel", framed && "rounded-control border border-line")}>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex h-10 items-center gap-6 px-3">
          {Array.from({ length: columns }, (_, col) => (
            <Bar key={col} className={col === 0 ? "w-1/4" : "w-1/6"} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** `framed={false}` di dalam Section: tanpa bingkai sendiri agar tidak ada kartu di dalam kartu. */
export function SkeletonCard({ framed = true }: { framed?: boolean }) {
  return (
    <div role="status" aria-busy="true" className={cn("space-y-3", framed && "rounded-control border border-line bg-panel p-5")}>
      <Bar className="w-1/3" />
      <Bar className="h-8 w-1/2" />
      <Bar className="w-2/3" />
    </div>
  );
}

export function SkeletonChart({ height = "h-56" }: { height?: string }) {
  return <div role="status" aria-busy="true" className={cn("w-full rounded-control border border-line", PULSE, height)} />;
}
