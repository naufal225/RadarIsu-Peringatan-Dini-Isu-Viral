// GET /labeling/posts dan PUT /labeling/posts/{id} (PRD §11, F14-a). Bentuk dari LabelingController dan
// LabelingPostResource (docs/CONTRACTS.md §2.8); tipe tinggal di lib/labeling.ts.

export type { LabelingPost, LabelingProgress, LabelingResponse, LabelingStatusFilter, ManualLabel } from "@/lib/labeling";

/** GET /labeling/daily: sebaran label per tanggal posting (UTC). Tanggal unggah tidak dicatat. */
export type LabelingDaily = {
  day: string;
  organic: number;
  anomalous: number;
  unlabeled: number;
};
