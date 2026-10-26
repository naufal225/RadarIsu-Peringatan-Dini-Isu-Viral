"use client";

import { useState } from "react";
import { Button, ErrorText, PageTitle, StatusBadge, Table, Td } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { manualLabelLabels, ui } from "@/lib/labels";
import { labelingStatusFilterLabels } from "@/lib/labels/labeling";
import {
  labelingPercent,
  labelingQuery,
  type LabelingPost,
  type LabelingResponse,
  type LabelingStatusFilter,
  type ManualLabel,
} from "@/lib/labeling";
import { useApiData } from "@/lib/use-api-data";

const copy = ui.labeling;

export function LabelingPanel() {
  const [status, setStatus] = useState<LabelingStatusFilter>("unlabeled");
  const [simulatedOnly, setSimulatedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const { data, error, reload } = useApiData<LabelingResponse>(labelingQuery({ status, simulatedOnly, page }));
  const progress = data?.meta.progress;

  return (
    <>
      <PageTitle>{copy.title}</PageTitle>
      <p className="mb-3 max-w-3xl text-sm text-neutral-600">{copy.intro}</p>
      <ErrorText>{error ? ui.common.loadError : null}</ErrorText>

      {progress && (
        <div className="mb-4 max-w-md">
          <div className="h-2 overflow-hidden rounded bg-neutral-200" role="progressbar" aria-valuenow={labelingPercent(progress)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-neutral-800" style={{ width: `${labelingPercent(progress)}%` }} />
          </div>
          <p className="mt-1 text-sm">{copy.progress(progress.labeled, progress.target)}</p>
          <p className="text-xs text-neutral-500">{copy.breakdown(progress.organic, progress.anomalous)}</p>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-end gap-4 text-sm">
        <label className="block">
          {copy.filters.status}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as LabelingStatusFilter);
              setPage(1);
            }}
            className="ml-2 rounded-md border border-neutral-300 px-2 py-1"
          >
            {Object.entries(labelingStatusFilterLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={simulatedOnly}
            onChange={(e) => {
              setSimulatedOnly(e.target.checked);
              setPage(1);
            }}
          />
          {copy.filters.simulated}
        </label>
      </div>

      {data === null ? (
        <p className="text-sm text-neutral-500">{ui.loading}</p>
      ) : data.data.length === 0 ? (
        <p className="text-sm text-neutral-500">{copy.empty}</p>
      ) : (
        <>
          <Table head={[copy.columns.post, copy.columns.account, copy.columns.label, copy.columns.actions]}>
            {data.data.map((post) => (
              <PostRow key={post.id} post={post} onChanged={reload} />
            ))}
          </Table>
          <div className="mt-3 flex items-center gap-3 text-sm">
            <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>
              {ui.common.previous}
            </Button>
            <span>{copy.page(data.meta.current_page, data.meta.last_page)}</span>
            <Button disabled={page >= data.meta.last_page} onClick={() => setPage(page + 1)}>
              {ui.common.next}
            </Button>
          </div>
        </>
      )}
    </>
  );
}

function PostRow({ post, onChanged }: { post: LabelingPost; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setLabel(label: ManualLabel | null) {
    setBusy(true);
    setError(null);
    try {
      await api(`labeling/posts/${post.id}`, { method: "PUT", body: JSON.stringify({ label_manual: label }) });
      onChanged();
    } catch {
      setError(ui.common.actionError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <Td className="max-w-xl">
        <p className="break-words">{post.text}</p>
        <p className="mt-1 text-xs text-neutral-500">
          {formatDateTime(post.posted_at)}
          {post.topics.length > 0 && ` · ${post.topics.map((t) => t.name).join(", ")}`}
        </p>
        {post.is_simulated && <StatusBadge tone="muted">{ui.simulatedData}</StatusBadge>}
      </Td>
      <Td>
        <div>{post.account?.handle ?? copy.noAccount}</div>
        {post.account?.display_name && <div className="text-xs text-neutral-500">{post.account.display_name}</div>}
      </Td>
      <Td>
        {post.label_manual ? (
          <StatusBadge tone={post.label_manual === "anomalous" ? "warn" : "ok"}>{manualLabelLabels[post.label_manual]}</StatusBadge>
        ) : (
          <span className="text-neutral-500">{copy.unlabeled}</span>
        )}
      </Td>
      <Td>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || post.label_manual === "organic"} onClick={() => setLabel("organic")}>
            {copy.setOrganic}
          </Button>
          <Button disabled={busy || post.label_manual === "anomalous"} onClick={() => setLabel("anomalous")}>
            {copy.setAnomalous}
          </Button>
          <Button disabled={busy || post.label_manual === null} onClick={() => setLabel(null)}>
            {copy.clear}
          </Button>
        </div>
        <ErrorText>{error}</ErrorText>
      </Td>
    </tr>
  );
}
