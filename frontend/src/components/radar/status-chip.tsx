import { Archive, Ban, CircleCheck, CircleDot, Eye, Undo2, ArrowUpRight, type LucideIcon } from "lucide-react";
import { alertStatusLabels } from "@/lib/labels";
import type { AlertStatus } from "./types";

export const STATUS_ICONS: Record<AlertStatus, LucideIcon> = {
  new: CircleDot,
  reviewing: Eye,
  escalated: ArrowUpRight,
  returned: Undo2,
  approved: CircleCheck,
  false_positive: Ban,
  closed: Archive,
};

/** Status alur kerja: monokrom (kontur, ikon, teks), tanpa warna status (Design System §2 #6). */
export function StatusChip({ status }: { status: AlertStatus }) {
  const Icon = STATUS_ICONS[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-badge border border-line-input bg-panel px-2 py-0.5 text-table font-medium text-ink">
      <Icon aria-hidden="true" className="size-3.5" />
      {alertStatusLabels[status]}
    </span>
  );
}
