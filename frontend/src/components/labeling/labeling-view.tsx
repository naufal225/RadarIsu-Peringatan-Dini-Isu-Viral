"use client";

import { CircleCheck, Eraser, TriangleAlert } from "lucide-react";
import { Button } from "@/components/radar/button";
import { FilterBar, FilterSelect } from "@/components/radar/filter-bar";
import { FieldError } from "@/components/radar/form";
import { PageHeader } from "@/components/radar/page-header";
import { Pagination } from "@/components/radar/pagination";
import { SimBadge } from "@/components/radar/simulation";
import { SkeletonRows } from "@/components/radar/skeleton";
import { EmptyState, ErrorState } from "@/components/radar/states";
import { Waktu } from "@/components/radar/waktu";
import type { LabelingPost, LabelingResponse, LabelingStatusFilter, ManualLabel } from "@/lib/api-types/labeling";
import { formatInteger } from "@/lib/format";
import { labelingPercent } from "@/lib/labeling";
import { manualLabelLabels, ui } from "@/lib/labels";
import { labelingStatusFilterLabels } from "@/lib/labels/labeling";

const copy = ui.labeling;

export type LabelingViewProps = {
  result: LabelingResponse | null;
  loading: boolean;
  failed: boolean;
  onRetry?: () => void;
  status: LabelingStatusFilter;
  onStatusChange: (status: LabelingStatusFilter) => void;
  simulatedOnly: boolean;
  onSimulatedOnlyChange: (value: boolean) => void;
  onPageChange: (page: number) => void;
  /** Post whose label is being saved. */
  busyId: number | null;
  /** Inline error for one post after a failed save. */
  rowError: { id: number; text: string } | null;
  onLabel: (post: LabelingPost, label: ManualLabel | null) => void;
};

/** Presentasi murni /labeling: kemajuan, filter, dan satu kartu per posting. */
export function LabelingView(props: LabelingViewProps) {
  const { result, loading, failed, onRetry, status, simulatedOnly } = props;
  const progress = result?.meta.progress ?? null;
  const posts = result?.data ?? [];

  return (
    <>
      <PageHeader title={copy.title} subtitle={copy.intro} />

      {progress && (
        <div className="mb-6 max-w-md">
          <div className="h-2 overflow-hidden rounded-badge bg-brand-tint" role="progressbar" aria-label={copy.progressLabel} aria-valuenow={labelingPercent(progress)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-brand" style={{ width: `${labelingPercent(progress)}%` }} />
          </div>
          <p className="mt-2 text-sm font-medium text-ink">{copy.progress(formatInteger(progress.labeled), formatInteger(progress.target))}</p>
          <p className="text-caption text-ink-muted">{copy.breakdown(formatInteger(progress.organic), formatInteger(progress.anomalous))}</p>
        </div>
      )}

      <FilterBar label={copy.filtersLabel}>
        <FilterSelect
          label={copy.filters.status}
          name="status"
          value={status === "all" ? "" : status}
          allLabel={labelingStatusFilterLabels.all}
          onChange={(v) => props.onStatusChange((v || "all") as LabelingStatusFilter)}
          options={(["unlabeled", "labeled"] as const).map((value) => ({ value, label: labelingStatusFilterLabels[value] }))}
        />
        <label className="flex items-center gap-2 pt-6 text-sm text-ink">
          <input type="checkbox" name="is_simulated" checked={simulatedOnly} onChange={(e) => props.onSimulatedOnlyChange(e.target.checked)} />
          {copy.filters.simulated}
        </label>
      </FilterBar>

      {failed ? (
        <ErrorState onRetry={onRetry} />
      ) : loading && result === null ? (
        <SkeletonRows rows={4} columns={2} />
      ) : posts.length === 0 ? (
        <EmptyState title={status === "unlabeled" && !simulatedOnly ? copy.allLabeled : copy.empty} />
      ) : (
        <>
          <ul aria-label={copy.listLabel} className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} {...props} />
            ))}
          </ul>
          {result && <Pagination page={result.meta.current_page} perPage={result.meta.per_page} total={result.meta.total} onPageChange={props.onPageChange} />}
        </>
      )}
    </>
  );
}

function PostCard({ post, busyId, rowError, onLabel }: LabelingViewProps & { post: LabelingPost }) {
  const busy = busyId === post.id;
  const label = post.label_manual;

  return (
    <li className="rounded-control border border-line bg-panel p-5">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-table text-ink-muted">
        <span className="font-mono text-ink">{post.account?.handle ?? copy.noAccount}</span>
        {post.account?.display_name && <span>{post.account.display_name}</span>}
        <Waktu value={post.posted_at} />
        {post.is_simulated && <SimBadge />}
      </div>
      {/* Teks dari sumber luar: dirender sebagai teks (ter-escape), tidak pernah sebagai HTML. */}
      <p className="whitespace-pre-wrap break-words font-mono text-sm text-ink">{post.text}</p>
      {post.topics.length > 0 && <p className="mt-2 text-caption text-ink-muted">{post.topics.map((t) => t.name).join(" · ")}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <span className="mr-2 flex items-center gap-1.5 text-table text-ink-muted">
          {copy.currentLabel}:
          {label ? (
            <span className="inline-flex items-center gap-1 rounded-badge border border-line-input px-1.5 py-0.5 font-medium text-ink">
              {label === "anomalous" ? <TriangleAlert aria-hidden="true" className="size-3.5" /> : <CircleCheck aria-hidden="true" className="size-3.5" />}
              {manualLabelLabels[label]}
            </span>
          ) : (
            <span>{copy.unlabeled}</span>
          )}
        </span>
        <Button variant={label === "organic" ? "primary" : "secondary"} aria-pressed={label === "organic"} disabled={busy || label === "organic"} onClick={() => onLabel(post, "organic")}>
          {copy.setOrganic}
        </Button>
        <Button variant={label === "anomalous" ? "primary" : "secondary"} aria-pressed={label === "anomalous"} disabled={busy || label === "anomalous"} onClick={() => onLabel(post, "anomalous")}>
          {copy.setAnomalous}
        </Button>
        <Button variant="ghost" disabled={busy || label === null} onClick={() => onLabel(post, null)}>
          <Eraser aria-hidden="true" className="size-4" />
          {copy.clear}
        </Button>
      </div>
      {rowError?.id === post.id && <FieldError>{rowError.text}</FieldError>}
    </li>
  );
}
