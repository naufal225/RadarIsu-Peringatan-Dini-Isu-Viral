"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/radar/button";
import { controlClass, Field, FieldError } from "@/components/radar/form";
import { PageHeader } from "@/components/radar/page-header";
import { Section } from "@/components/radar/section";
import { SeverityBadge } from "@/components/radar/severity-badge";
import { SkeletonCard } from "@/components/radar/skeleton";
import { ErrorState } from "@/components/radar/states";
import { Waktu } from "@/components/radar/waktu";
import type { DetectionSettings, OfflineModeResponse, SettingsResponse } from "@/lib/api-types/settings";
import { cn } from "@/lib/cn";
import {
  effectiveZ,
  FIELD_RANGES,
  getPath,
  isFieldInvalid,
  isOutOfRange,
  previewImpersonation,
  previewScore,
  SENSITIVITIES,
  validateDetection,
  WEIGHT_KEYS,
  weightsTotal,
  type PreviewInput,
} from "@/lib/detection-settings";
import { formatNumber } from "@/lib/format";
import { ui } from "@/lib/labels";

const copy = ui.settings;

type FieldPath = keyof typeof copy.fields;

const GROUPS: { title: string; fields: FieldPath[] }[] = [
  { title: copy.groups.spike, fields: ["z_threshold", "min_volume", "baseline_hours", "min_baseline_hours", "spike_current_window_minutes", "spike_sample_limit"] },
  {
    title: copy.groups.coordination,
    fields: ["coordination_window_minutes", "similarity_threshold", "min_accounts_cluster", "young_account_days", "synchronized_window_minutes", "synchronized_ratio", "coordination_max_posts"],
  },
  { title: copy.groups.impersonation, fields: ["impersonation_threshold", "impersonation_window_hours"] },
  { title: copy.groups.alertControl, fields: ["cooldown_minutes"] },
  { title: copy.groups.weights, fields: WEIGHT_KEYS.map((key) => `weights.${key}` as FieldPath) },
  { title: copy.groups.severity, fields: ["severity_cutoffs.medium", "severity_cutoffs.high"] },
  { title: copy.groups.sensitivity, fields: SENSITIVITIES.map((key) => `sensitivity_z_offset.${key}` as FieldPath) },
];

export type SettingsViewProps = {
  loaded: SettingsResponse["data"] | null;
  loading: boolean;
  failed: boolean;
  onRetry?: () => void;
  draft: DetectionSettings | null;
  onChange: (path: string, raw: string) => void;
  /** Field paths from a 422 on save. */
  serverFields: string[];
  pending: boolean;
  saveFailed: boolean;
  saved: boolean;
  onSubmit: () => void;
  onReset: () => void;
  offline: {
    loaded: OfflineModeResponse["data"] | null;
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
    onSave: () => void;
    pending: boolean;
    saved: boolean;
    failed: boolean;
  };
};

function LastUpdated({ at, by, label }: { at: string | null; by: { name: string } | null; label: (name: string) => string }) {
  if (!at || !by) return <p className="text-caption text-ink-muted">{copy.neverUpdated}</p>;
  return (
    <p className="flex flex-wrap items-center gap-1 text-caption text-ink-muted">
      {label(by.name)} <Waktu value={at} className="text-caption" />
    </p>
  );
}

function Saved({ text }: { text: string }) {
  return (
    <p role="status" className="flex items-center gap-1.5 text-table text-ink">
      <CircleCheck aria-hidden="true" className="size-4" />
      {text}
    </p>
  );
}

/** Presentasi murni halaman Pengaturan Deteksi (docs/UI_PAGES.md, /admin/settings). */
export function SettingsView(props: SettingsViewProps) {
  const { loaded, loading, failed, onRetry, draft } = props;

  return (
    <>
      <PageHeader title={copy.title} subtitle={copy.intro} />
      {failed ? (
        <ErrorState onRetry={onRetry} />
      ) : loading || !loaded || !draft ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <DetectionForm {...props} loaded={loaded} draft={draft} />
      )}
      <OfflineSection {...props.offline} />
    </>
  );
}

function DetectionForm({ loaded, draft, onChange, serverFields, pending, saveFailed, saved, onSubmit, onReset }: SettingsViewProps & { loaded: SettingsResponse["data"]; draft: DetectionSettings }) {
  const clientFields = validateDetection(draft);
  const invalid = new Set([...clientFields, ...serverFields]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(loaded.value);
  const total = weightsTotal(draft);
  const brokenRules = [...invalid].map((field) => copy.rules[field]).filter(Boolean);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <>
      <form onSubmit={submit}>
        {GROUPS.map((group) => (
          <Section key={group.title} title={group.title}>
            <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
              {group.fields.map((path) => (
                <NumberField key={path} path={path} value={getPath(draft, path)} invalid={isFieldInvalid(invalid, path)} outOfRange={isOutOfRange(draft, path)} fromServer={serverFields.includes(path)} onChange={onChange} />
              ))}
            </div>
            {group.title === copy.groups.weights && (
              // Peringatan UI saja; server tetap yang memvalidasi.
              <p className={cn("mt-3 flex items-center gap-1.5 text-table", total === 100 ? "text-ink" : "text-sev-high")}>
                {total === 100 ? <CircleCheck aria-hidden="true" className="size-4" /> : <TriangleAlert aria-hidden="true" className="size-4" />}
                {copy.weightsTotal(Number.isFinite(total) ? total : 0)}
                {total !== 100 && <span>· {copy.weightsWarning}</span>}
              </p>
            )}
          </Section>
        ))}

        <div className="mb-8 max-w-4xl space-y-3">
          {brokenRules.map((rule) => (
            <FieldError key={rule}>{rule}</FieldError>
          ))}
          {saveFailed && <FieldError>{ui.common.actionError}</FieldError>}
          {saved && !dirty && <Saved text={copy.saved} />}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" pending={pending} disabled={!dirty || clientFields.length > 0}>
              {pending ? ui.common.saving : copy.save}
            </Button>
            <Button onClick={onReset} disabled={pending || !dirty}>
              {copy.reset}
            </Button>
          </div>
          <LastUpdated at={loaded.updated_at} by={loaded.updated_by} label={copy.lastUpdatedBy} />
        </div>
      </form>

      <FormulaPreview settings={draft} usable={clientFields.length === 0} />
    </>
  );
}

function NumberField({
  path,
  value,
  invalid,
  outOfRange,
  fromServer,
  onChange,
}: {
  path: FieldPath;
  value: number;
  invalid: boolean;
  outOfRange: boolean;
  fromServer: boolean;
  onChange: (path: string, raw: string) => void;
}) {
  const range = FIELD_RANGES[path];
  const text = copy.fields[path];
  const message = outOfRange
    ? copy.outOfRange(formatNumber(range.min, 0, 2), formatNumber(range.max, 0, 2), range.integer)
    : fromServer
      ? copy.serverRejected
      : null;

  return (
    <Field label={text.label} hint={text.hint} error={message}>
      <input
        type="number"
        required
        name={path}
        min={range.min}
        max={range.max}
        step={range.step}
        value={Number.isNaN(value) ? "" : value}
        aria-invalid={invalid}
        onChange={(e) => onChange(path, e.target.value)}
        className={cn(controlClass, invalid && "border-sev-high")}
      />
    </Field>
  );
}

const SAMPLE: PreviewInput = { z: 5.1, anomalousRatio: 0.4, negativeRatio: 0.62, reachRatio: 0.67 };

function FormulaPreview({ settings, usable }: { settings: DetectionSettings; usable: boolean }) {
  const [input, setInput] = useState<PreviewInput>(SAMPLE);
  const [similarity, setSimilarity] = useState(settings.impersonation_threshold);
  const [young, setYoung] = useState(true);
  const labels = copy.preview;
  const preview = previewScore(settings, input);
  const impersonation = previewImpersonation(settings, similarity, young);

  return (
    <Section title={labels.title} description={labels.intro}>
      <p className="mb-4 max-w-4xl rounded-control border border-line bg-paper p-3 font-mono text-caption text-ink">
        {Number.isNaN(weightsTotal(settings)) ? "…" : labels.formula(settings.weights)}
      </p>
      <div className="mb-4 grid max-w-4xl gap-4 sm:grid-cols-2">
        {(Object.keys(labels.inputs) as (keyof PreviewInput)[]).map((key) => (
          <Field key={key} label={labels.inputs[key]}>
            <input
              type="number"
              name={`preview_${key}`}
              min={0}
              step={key === "z" ? 0.1 : 0.01}
              value={input[key]}
              onChange={(e) => setInput((current) => ({ ...current, [key]: e.target.value === "" ? 0 : Number(e.target.value) }))}
              className={controlClass}
            />
          </Field>
        ))}
      </div>

      {usable ? (
        <div className="max-w-3xl space-y-5">
          <div className="overflow-x-auto rounded-control border border-line">
            <table className="w-full text-left text-table">
              <caption className="sr-only">{labels.title}</caption>
              <thead className="border-b border-line bg-paper text-ink-muted">
                <tr>
                  {[labels.component, labels.raw, labels.weight, labels.points].map((h) => (
                    <th key={h} scope="col" className="h-9 px-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {WEIGHT_KEYS.map((key) => (
                  <tr key={key} className="h-9">
                    <td className="px-3">{labels.components[key]}</td>
                    <td className="px-3 font-mono">{formatNumber(preview.components[key].raw)}</td>
                    <td className="px-3 font-mono">{preview.components[key].weight}</td>
                    <td className="px-3 font-mono">{formatNumber(preview.components[key].value, 1, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            {labels.score}: <strong className="tabular-nums">{preview.score}</strong> · {labels.severity}: <SeverityBadge severity={preview.severity} size="sm" />
          </p>
          <div>
            <p className="mb-1 text-sm font-medium">{labels.effectiveZ}</p>
            <ul className="text-sm text-ink">
              {SENSITIVITIES.map((key) => (
                <li key={key}>
                  {copy.fields[`sensitivity_z_offset.${key}`].label}: <strong className="font-mono">{formatNumber(effectiveZ(settings, key), 1, 2)}</strong>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-caption text-ink-muted">{labels.effectiveZNote}</p>
          </div>
          <p className="text-caption text-ink-muted">{labels.cooldownNote(settings.cooldown_minutes)}</p>

          <div>
            <p className="mb-1 text-sm font-medium">{labels.impersonationTitle}</p>
            <p className="mb-2 text-caption text-ink-muted">{labels.impersonationFormula}</p>
            <div className="mb-2 grid gap-4 sm:grid-cols-2">
              <Field label={labels.similarity}>
                <input type="number" name="preview_similarity" min={0} max={1} step={0.01} value={similarity} onChange={(e) => setSimilarity(e.target.value === "" ? 0 : Number(e.target.value))} className={controlClass} />
              </Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" name="preview_young" checked={young} onChange={(e) => setYoung(e.target.checked)} />
                {labels.youngAccount}
              </label>
            </div>
            <p className="flex flex-wrap items-center gap-2 text-sm">
              {labels.score}: <strong className="tabular-nums">{impersonation.score}</strong> · {labels.severity}: <SeverityBadge severity={impersonation.severity} size="sm" /> · {labels.similarityPoints}:{" "}
              {formatNumber(impersonation.similarityPoints, 1, 1)} · {labels.youngPoints}: {impersonation.youngPoints}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">{labels.unavailable}</p>
      )}
    </Section>
  );
}

function OfflineSection({ loaded, enabled, onToggle, onSave, pending, saved, failed }: SettingsViewProps["offline"]) {
  const offline = copy.offline;
  return (
    <Section title={offline.title} description={offline.intro}>
      {loaded === null ? (
        failed ? <ErrorState /> : <SkeletonCard />
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
          className="max-w-3xl space-y-3"
        >
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="enabled" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
            {offline.enabled}
          </label>
          {failed && <FieldError>{ui.common.actionError}</FieldError>}
          {saved && enabled === loaded.value.enabled && <Saved text={offline.saved} />}
          <Button type="submit" variant="primary" pending={pending} disabled={enabled === loaded.value.enabled}>
            {pending ? ui.common.saving : offline.save}
          </Button>
          <LastUpdated at={loaded.updated_at} by={loaded.updated_by} label={offline.lastUpdatedBy} />
        </form>
      )}
    </Section>
  );
}
