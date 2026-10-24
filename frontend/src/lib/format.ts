import { ui } from "./labels";

const dateTime = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });

/** Localised date-time for an ISO string from the API; empty values render as a dash. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return ui.common.none;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTime.format(date);
}

/** Number with the Indonesian decimal comma, e.g. 5.1 -> "5,1". */
export function formatDecimal(value: number, minDigits = 0, maxDigits = 2): string {
  return value.toLocaleString("id-ID", { minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits });
}

/** Validation error map from a Laravel 422 body, flattened to field names. */
export function invalidFields(body: { errors?: Record<string, string[]> } | null): string[] {
  return Object.keys(body?.errors ?? {});
}
