import { formatUtc, formatWib, parseTime, toIso, type TimeFormat, type TimeInput } from "@/lib/format/time";
import { cn } from "@/lib/cn";

/**
 * Satu-satunya cara menampilkan timestamp (Design System §5): WIB di UI, UTC saat hover atau fokus,
 * atau `utc="inline"` sebagai baris kedua. Nilai selalu dari data, bukan dari jam browser.
 */
export function Waktu({
  value,
  format = "datetime",
  utc = "hover",
  className,
}: {
  value: TimeInput;
  format?: TimeFormat;
  utc?: "hover" | "inline";
  className?: string;
}) {
  if (!parseTime(value)) {
    if (process.env.NODE_ENV !== "production" && value !== null && value !== undefined && value !== "") {
      console.warn("<Waktu> menerima nilai yang bukan tanggal:", value);
    }
    return <span className={cn("font-mono text-table text-ink-muted", className)}>—</span>;
  }

  const iso = toIso(value);
  const wib = formatWib(value, format);
  const utcText = formatUtc(value, format);

  if (utc === "inline") {
    return (
      <time dateTime={iso} className={cn("block whitespace-nowrap font-mono text-table", className)}>
        {wib}
        <span className="block text-caption text-ink-muted">{utcText}</span>
      </time>
    );
  }

  // Tooltip memakai CSS (hover dan fokus), jadi bekerja di keyboard dan tidak butuh JavaScript klien.
  return (
    <span className="group relative inline-block">
      <time dateTime={iso} tabIndex={0} className={cn("whitespace-nowrap font-mono text-table", className)} aria-label={`${wib} (${utcText})`}>
        {wib}
      </time>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden whitespace-nowrap rounded-control border border-line bg-panel px-2 py-1 font-mono text-caption text-ink group-focus-within:block group-hover:block"
      >
        {utcText}
        <span className="block text-ink-muted">{iso}</span>
      </span>
    </span>
  );
}
