import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Label kecil untuk keadaan, bukan severity (severity memakai SeverityBadge).
 * Tanpa warna hijau: "ok" netral dengan kontur.
 */
export type TagTone = "neutral" | "danger" | "warn" | "muted";

const TONE: Record<TagTone, string> = {
  neutral: "border border-line-input bg-hover text-ink",
  danger: "bg-sev-high-bg text-sev-high",
  warn: "bg-sev-medium-bg text-sev-medium",
  muted: "bg-hover text-ink-muted",
};

export function Tag({ tone = "neutral", children }: { tone?: TagTone; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-badge px-2 py-0.5 text-caption font-medium", TONE[tone])}>{children}</span>;
}
