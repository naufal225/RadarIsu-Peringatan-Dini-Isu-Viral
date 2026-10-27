import { ui } from "../labels";
import { formatWib, parseTime } from "./time";

export * from "./number";
export * from "./time";

/**
 * Legacy date-time helper kept for panels that have not moved to `<Waktu>` yet. It now renders in WIB
 * like the new component; unparseable values still pass through as-is.
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return ui.common.none;
  return parseTime(value) ? formatWib(value) : value;
}

/** Number with the Indonesian decimal comma, e.g. 5.1 -> "5,1". */
export function formatDecimal(value: number, minDigits = 0, maxDigits = 2): string {
  return value.toLocaleString("id-ID", { minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits });
}

/** Validation error map from a Laravel 422 body, flattened to field names. */
export function invalidFields(body: { errors?: Record<string, string[]> } | null): string[] {
  return Object.keys(body?.errors ?? {});
}
