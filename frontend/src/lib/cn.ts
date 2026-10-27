/** Joins class names, skipping falsy values. No dependency on clsx/tailwind-merge. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
