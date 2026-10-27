// Angka (docs/UI_DESIGN_SYSTEM.md §4): format id-ID, ribuan titik dan desimal koma.

const NONE = "—";

const integer = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NONE;
  return integer.format(value);
}

/** Number with a fixed range of decimals, e.g. formatNumber(0.912, 3, 3) -> "0,912". */
export function formatNumber(value: number | null | undefined, minDigits = 0, maxDigits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NONE;
  return value.toLocaleString("id-ID", { minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits });
}

/** Ratio as a percent without decimals by default: 0.912 -> "91%". The raw value belongs in a tooltip. */
export function formatPercent(ratio: number | null | undefined, digits = 0): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return NONE;
  const text = (ratio * 100).toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${text}%`;
}

/** Threat score: a whole number 0-100, rounded and clamped. */
export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined || !Number.isFinite(score)) return NONE;
  return String(Math.min(100, Math.max(0, Math.round(score))));
}
