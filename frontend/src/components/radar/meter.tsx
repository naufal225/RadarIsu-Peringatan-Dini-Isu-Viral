import { cn } from "@/lib/cn";

/** Batang ukur sederhana dengan warna dari token. Lebar dihitung dari nilai terhadap maksimum (0–100%). */
export function Meter({ value, max, tone = "bg-brand", label }: { value: number; max: number; tone?: string; label: string }) {
  const percent = max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0;
  return (
    <span className="block h-2 w-full overflow-hidden rounded-badge bg-hover" role="img" aria-label={label}>
      <span className={cn("block h-full", tone)} style={{ width: `${percent}%` }} />
    </span>
  );
}

/** Batang bertumpuk: satu bar dibagi segmen sesuai bagian masing-masing (jumlah segmen dibagi total). */
export function StackedMeter({ parts, label }: { parts: { value: number; tone: string; name: string }[]; label: string }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return (
    <span className="flex h-2 w-full overflow-hidden rounded-badge bg-hover" role="img" aria-label={label}>
      {parts.map((part) => (
        <span
          key={part.name}
          className={part.tone}
          style={{ width: total > 0 ? `${(part.value / total) * 100}%` : "0%" }}
          title={`${part.name}: ${part.value}`}
        />
      ))}
    </span>
  );
}
