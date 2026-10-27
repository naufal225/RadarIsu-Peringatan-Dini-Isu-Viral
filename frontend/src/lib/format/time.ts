// Waktu (docs/UI_DESIGN_SYSTEM.md §5): WIB di UI, UTC saat hover. Selalu isi timeZone secara eksplisit
// supaya hasil di server dan di browser sama (hidrasi). Tidak ada waktu relatif.

export type TimeFormat = "datetime" | "date" | "time";
export type TimeInput = string | Date | null | undefined;

const NONE = "—";

const WIB_ZONE = "Asia/Jakarta";

function parts(zone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: zone,
    hourCycle: "h23",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const wibFormatter = parts(WIB_ZONE);
const utcFormatter = parts("UTC");

/** Parses an ISO string or Date; anything missing or invalid is null. */
export function parseTime(value: TimeInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function render(formatter: Intl.DateTimeFormat, date: Date, format: TimeFormat, label: string): string {
  const get = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  const day = `${get.day} ${get.month} ${get.year}`;
  const time = `${get.hour}.${get.minute} ${label}`;
  if (format === "date") return day;
  if (format === "time") return time;
  return `${day} · ${time}`;
}

/** "27 Okt 2026 · 14.29 WIB"; empty or invalid values give a dash. */
export function formatWib(value: TimeInput, format: TimeFormat = "datetime"): string {
  const date = parseTime(value);
  if (!date) return NONE;
  return render(wibFormatter, date, format, "WIB");
}

/** Same layout in UTC, e.g. "27 Okt 2026 · 07.29 UTC". */
export function formatUtc(value: TimeInput, format: TimeFormat = "datetime"): string {
  const date = parseTime(value);
  if (!date) return NONE;
  return render(utcFormatter, date, format, "UTC");
}

/** ISO 8601 in UTC for the `dateTime` attribute and the hover text; empty string when invalid. */
export function toIso(value: TimeInput): string {
  const date = parseTime(value);
  return date ? date.toISOString() : "";
}
