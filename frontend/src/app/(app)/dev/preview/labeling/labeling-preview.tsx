"use client";

import { useState } from "react";
import { LabelingView, type LabelingViewProps } from "@/components/labeling/labeling-view";
import { PageHeader } from "@/components/radar/page-header";
import { LABELING_DONE, LABELING_PAGE } from "@/fixtures/labeling";
import type { LabelingPost, ManualLabel } from "@/lib/api-types/labeling";
import { ui } from "@/lib/labels";

const noop = () => undefined;

const BASE: LabelingViewProps = {
  daily: null,
  result: LABELING_PAGE,
  loading: false,
  failed: false,
  onRetry: noop,
  status: "all",
  onStatusChange: noop,
  simulatedOnly: false,
  onSimulatedOnlyChange: noop,
  onPageChange: noop,
  busyId: null,
  rowError: null,
  onLabel: noop,
};

const CASES: { title: string; props: Partial<LabelingViewProps> }[] = [
  { title: `${ui.preview.empty} · ${ui.labeling.allLabeled}`, props: { result: LABELING_DONE, status: "unlabeled" } },
  { title: ui.preview.loading, props: { result: null, loading: true } },
  { title: ui.preview.error, props: { result: null, failed: true } },
];

/** /dev/preview/labeling: LabelingView dengan fixture. Kasus pertama interaktif (label berubah di tempat). */
export function LabelingPreview() {
  const [posts, setPosts] = useState(LABELING_PAGE.data);
  const label = (post: LabelingPost, value: ManualLabel | null) => setPosts((list) => list.map((p) => (p.id === post.id ? { ...p, label_manual: value } : p)));

  return (
    <>
      <PageHeader title={ui.preview.title(ui.labeling.title)} subtitle={ui.preview.subtitle} />
      <section className="mb-12 border-t border-line pt-6">
        <h2 className="mb-4 text-section font-semibold text-ink-muted">{ui.preview.normal}</h2>
        <LabelingView {...BASE} result={{ ...LABELING_PAGE, data: posts }} onLabel={label} rowError={{ id: 303, text: ui.common.actionError }} />
      </section>
      {CASES.map(({ title, props }) => (
        <section key={title} className="mb-12 border-t border-line pt-6">
          <h2 className="mb-4 text-section font-semibold text-ink-muted">{title}</h2>
          <LabelingView {...BASE} {...props} />
        </section>
      ))}
    </>
  );
}
