"use client";

import { useState } from "react";
import { PageHeader } from "@/components/radar/page-header";
import { SettingsView, type SettingsViewProps } from "@/components/settings/settings-view";
import { DEFAULT_DETECTION, DETECTION_NEVER_CHANGED, DETECTION_RESPONSE, OFFLINE_RESPONSE } from "@/fixtures/settings";
import type { DetectionSettings } from "@/lib/api-types/settings";
import { setPath } from "@/lib/detection-settings";
import { ui } from "@/lib/labels";

const noop = () => undefined;

const OFFLINE: SettingsViewProps["offline"] = { loaded: OFFLINE_RESPONSE.data, enabled: false, onToggle: noop, onSave: noop, pending: false, saved: false, failed: false };

const BASE: SettingsViewProps = {
  loaded: DETECTION_RESPONSE.data,
  loading: false,
  failed: false,
  onRetry: noop,
  draft: DEFAULT_DETECTION,
  onChange: noop,
  serverFields: [],
  pending: false,
  saveFailed: false,
  saved: false,
  onSubmit: noop,
  onReset: noop,
  offline: OFFLINE,
};

const BROKEN: DetectionSettings = { ...DEFAULT_DETECTION, weights: { spike: 50, anomaly: 30, sentiment: 20, reach: 10 }, z_threshold: 12, severity_cutoffs: { medium: 80, high: 70 } };

const CASES: { title: string; props: Partial<SettingsViewProps> }[] = [
  { title: `${ui.preview.normal} · ${ui.settings.neverUpdated}`, props: { loaded: DETECTION_NEVER_CHANGED.data } },
  { title: ui.preview.invalid, props: { draft: BROKEN, serverFields: ["weights"] } },
  { title: ui.preview.loading, props: { loaded: null, draft: null, loading: true, offline: { ...OFFLINE, loaded: null } } },
  { title: ui.preview.error, props: { loaded: null, draft: null, failed: true, offline: { ...OFFLINE, loaded: null, failed: true } } },
];

/** /dev/preview/settings: SettingsView dengan fixture. Kasus pertama interaktif (ubah nilai, total bobot, pratinjau). */
export function SettingsPreview() {
  const [draft, setDraft] = useState<DetectionSettings>(DEFAULT_DETECTION);
  const [enabled, setEnabled] = useState(false);

  return (
    <>
      <PageHeader title={ui.preview.title(ui.settings.title)} subtitle={ui.preview.subtitle} />
      <section className="mb-12 border-t border-line pt-6">
        <h2 className="mb-4 text-section font-semibold text-ink-muted">{ui.preview.normal}</h2>
        <SettingsView
          {...BASE}
          draft={draft}
          onChange={(path, raw) => setDraft((d) => setPath(d, path, raw === "" ? Number.NaN : Number(raw)))}
          onReset={() => setDraft(DEFAULT_DETECTION)}
          offline={{ ...OFFLINE, enabled, onToggle: setEnabled }}
        />
      </section>
      {CASES.map(({ title, props }) => (
        <section key={title} className="mb-12 border-t border-line pt-6">
          <h2 className="mb-4 text-section font-semibold text-ink-muted">{title}</h2>
          <SettingsView {...BASE} {...props} />
        </section>
      ))}
    </>
  );
}
