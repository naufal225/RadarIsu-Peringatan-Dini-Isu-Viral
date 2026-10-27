import { CircleAlert, Info, ShieldAlert, type LucideIcon } from "lucide-react";
import { severityLabels } from "@/lib/labels";
import { cn } from "@/lib/cn";
import type { Severity } from "./types";

const STYLES: Record<Severity, { icon: LucideIcon; tone: string }> = {
  high: { icon: ShieldAlert, tone: "bg-sev-high-bg text-sev-high border-sev-high" },
  medium: { icon: CircleAlert, tone: "bg-sev-medium-bg text-sev-medium border-sev-medium" },
  low: { icon: Info, tone: "bg-sev-low-bg text-sev-low border-sev-low" },
};

const SIZES = {
  sm: "px-1.5 py-0.5 text-caption gap-1 [&>svg]:size-3",
  md: "px-2 py-1 text-table gap-1.5 [&>svg]:size-4",
  lg: "px-3 py-1.5 text-section gap-2 font-semibold [&>svg]:size-5",
} as const;

/** Severity selalu ikon + teks, tidak pernah hanya warna (Design System §2 #5). */
export function SeverityBadge({ severity, size = "md" }: { severity: Severity; size?: keyof typeof SIZES }) {
  const { icon: Icon, tone } = STYLES[severity];
  return (
    <span className={cn("inline-flex items-center rounded-badge border font-medium", tone, SIZES[size])}>
      <Icon aria-hidden="true" />
      {severityLabels[severity]}
    </span>
  );
}
