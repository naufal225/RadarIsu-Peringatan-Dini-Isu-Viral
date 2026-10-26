"use client";

import { useState, type FormEvent } from "react";
import { Button, ErrorText, Field, inputClass, PageTitle, Section, StatusBadge, Table, Td } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import {
  effectiveZ,
  FIELD_RANGES,
  getPath,
  previewImpersonation,
  previewScore,
  SENSITIVITIES,
  setPath,
  validateDetection,
  WEIGHT_KEYS,
  weightsTotal,
  type DetectionSettings,
  type OfflineModeResponse,
  type PreviewInput,
  type SettingsResponse,
} from "@/lib/detection-settings";
import { formatDateTime, formatDecimal, invalidFields } from "@/lib/format";
import { severityLabels, ui } from "@/lib/labels";
import { useApiData } from "@/lib/use-api-data";

const copy = ui.settings;

type FieldPath = keyof typeof copy.fields;

const GROUPS: { title: string; fields: FieldPath[] }[] = [
  {
    title: copy.groups.spike,
    fields: [
      "z_threshold",
      "min_volume",
      "baseline_hours",
      "min_baseline_hours",
      "spike_current_window_minutes",
      "spike_sample_limit",
    ],
  },
  {
    title: copy.groups.coordination,
    fields: [
      "coordination_window_minutes",
      "similarity_threshold",
      "min_accounts_cluster",
      "young_account_days",
      "synchronized_window_minutes",
      "synchronized_ratio",
      "coordination_max_posts",
    ],
  },
  { title: copy.groups.impersonation, fields: ["impersonation_threshold", "impersonation_window_hours"] },
  { title: copy.groups.alertControl, fields: ["cooldown_minutes"] },
  { title: copy.groups.weights, fields: WEIGHT_KEYS.map((key) => `weights.${key}` as FieldPath) },
  { title: copy.groups.severity, fields: ["severity_cutoffs.medium", "severity_cutoffs.high"] },
  { title: copy.groups.sensitivity, fields: SENSITIVITIES.map((key) => `sensitivity_z_offset.${key}` as FieldPath) },
];

export function SettingsPanel() {
  const { data, error: loadError, reload } = useApiData<SettingsResponse>("settings/detection");
  // Kept here: the form below remounts with fresh state after every save.
  const [saved, setSaved] = useState(false);

  return (
    <>
      <PageTitle>{copy.title}</PageTitle>
      <p className="mb-4 max-w-3xl text-sm text-neutral-600">{copy.intro}</p>
      <ErrorText>{loadError ? ui.common.loadError : null}</ErrorText>
      {data === null ? (
        <p className="text-sm text-neutral-500">{ui.loading}</p>
      ) : (
        // Remounts with fresh form state after every save or reload.
        <SettingsForm
          key={data.data.updated_at ?? "initial"}
          loaded={data.data}
          saved={saved}
          onSaved={() => {
            setSaved(true);
            reload();
          }}
          onEdit={() => setSaved(false)}
        />
      )}
      <OfflineModeSection />
    </>
  );
}

function OfflineModeSection() {
  const { data, error: loadError, reload } = useApiData<OfflineModeResponse>("settings/offline-mode");
  const offline = ui.settings.offline;

  return (
    <Section title={offline.title}>
      <p className="mb-3 max-w-3xl text-sm text-neutral-600">{offline.intro}</p>
      <ErrorText>{loadError ? ui.common.loadError : null}</ErrorText>
      {data === null ? (
        <p className="text-sm text-neutral-500">{ui.loading}</p>
      ) : (
        <OfflineModeForm key={data.data.updated_at ?? "initial"} loaded={data.data} onSaved={reload} />
      )}
    </Section>
  );
}

function OfflineModeForm({ loaded, onSaved }: { loaded: OfflineModeResponse["data"]; onSaved: () => void }) {
  const offline = ui.settings.offline;
  const [enabled, setEnabled] = useState(loaded.value.enabled);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api("settings/offline-mode", { method: "PUT", body: JSON.stringify({ enabled }) });
      setSaved(true);
      onSaved();
    } catch {
      setError(ui.common.actionError);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            setSaved(false);
          }}
        />
        {offline.enabled}
      </label>
      <ErrorText>{error}</ErrorText>
      {saved && <p className="text-sm text-green-700">{offline.saved}</p>}
      <Button type="submit" variant="primary" disabled={pending || enabled === loaded.value.enabled}>
        {pending ? ui.common.saving : offline.save}
      </Button>
      <p className="text-xs text-neutral-500">
        {loaded.updated_at && loaded.updated_by
          ? offline.lastUpdated(loaded.updated_by.name, formatDateTime(loaded.updated_at))
          : offline.neverUpdated}
      </p>
    </form>
  );
}

function SettingsForm({
  loaded,
  saved,
  onSaved,
  onEdit,
}: {
  loaded: SettingsResponse["data"];
  saved: boolean;
  onSaved: () => void;
  onEdit: () => void;
}) {
  const [draft, setDraft] = useState<DetectionSettings>(loaded.value);
  const [serverFields, setServerFields] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientFields = validateDetection(draft);
  const invalid = new Set([...clientFields, ...serverFields]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(loaded.value);

  function change(path: string, raw: string) {
    setDraft((current) => setPath(current, path, raw === "" ? Number.NaN : Number(raw)));
    setServerFields([]);
    onEdit();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setServerFields([]);
    onEdit();
    try {
      await api("settings/detection", { method: "PUT", body: JSON.stringify(draft) });
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setServerFields(invalidFields(e.body));
      else setError(ui.common.actionError);
    } finally {
      setPending(false);
    }
  }

  const total = weightsTotal(draft);
  const brokenRules = [...invalid].map((field) => copy.rules[field]).filter(Boolean);

  return (
    <>
      <form onSubmit={submit} className="mb-10">
        {GROUPS.map((group) => (
          <Section key={group.title} title={group.title}>
            <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
              {group.fields.map((path) => (
                <NumberField
                  key={path}
                  path={path}
                  value={getPath(draft, path)}
                  invalid={invalid.has(path) || invalid.has(path.split(".")[0])}
                  onChange={change}
                />
              ))}
            </div>
            {group.title === copy.groups.weights && (
              <p className={`mt-2 text-sm ${total === 100 ? "text-green-700" : "text-red-600"}`}>{copy.weightsTotal(total)}</p>
            )}
          </Section>
        ))}

        <div className="max-w-4xl space-y-2">
          {brokenRules.map((rule) => (
            <ErrorText key={rule}>{rule}</ErrorText>
          ))}
          {serverFields.length > 0 && (
            <ErrorText>
              {copy.invalidFields} {serverFields.join(", ")}
            </ErrorText>
          )}
          <ErrorText>{error}</ErrorText>
          {saved && <p className="text-sm text-green-700">{copy.saved}</p>}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={pending || !dirty || clientFields.length > 0}>
              {pending ? ui.common.saving : copy.save}
            </Button>
            <Button type="button" disabled={pending || !dirty} onClick={() => setDraft(loaded.value)}>
              {copy.reset}
            </Button>
          </div>
          <p className="text-xs text-neutral-500">
            {loaded.updated_at && loaded.updated_by
              ? copy.lastUpdated(loaded.updated_by.name, formatDateTime(loaded.updated_at))
              : copy.neverUpdated}
          </p>
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
  onChange,
}: {
  path: FieldPath;
  value: number;
  invalid: boolean;
  onChange: (path: string, raw: string) => void;
}) {
  const range = FIELD_RANGES[path];
  const text = copy.fields[path];

  return (
    <Field label={text.label}>
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
        className={`${inputClass} ${invalid ? "border-red-500" : ""}`}
      />
      <span className="mt-1 block text-xs font-normal text-neutral-500">{text.hint}</span>
    </Field>
  );
}

const SAMPLE: PreviewInput = { z: 5.1, anomalousRatio: 0.4, negativeRatio: 0.62, reachRatio: 0.67 };

function FormulaPreview({ settings, usable }: { settings: DetectionSettings; usable: boolean }) {
  const [input, setInput] = useState<PreviewInput>(SAMPLE);
  const preview = previewScore(settings, input);
  const labels = copy.preview;

  function set(key: keyof PreviewInput, raw: string) {
    setInput((current) => ({ ...current, [key]: raw === "" ? 0 : Number(raw) }));
  }

  return (
    <Section title={labels.title}>
      <p className="mb-3 max-w-3xl text-sm text-neutral-600">{labels.intro}</p>
      <p className="mb-4 max-w-4xl rounded-md bg-neutral-50 p-3 font-mono text-xs text-neutral-900">
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
              onChange={(e) => set(key, e.target.value)}
              className={inputClass}
            />
          </Field>
        ))}
      </div>

      {usable ? (
        <div className="max-w-3xl space-y-4">
          <Table head={[labels.component, labels.raw, labels.weight, labels.points]}>
            {WEIGHT_KEYS.map((key) => (
              <tr key={key}>
                <Td>{labels.components[key]}</Td>
                <Td>{formatDecimal(preview.components[key].raw)}</Td>
                <Td>{preview.components[key].weight}</Td>
                <Td>{formatDecimal(preview.components[key].value, 1, 1)}</Td>
              </tr>
            ))}
          </Table>
          <p className="text-sm">
            {labels.score}: <strong>{preview.score}</strong> · {labels.severity}:{" "}
            <StatusBadge tone={preview.severity === "high" ? "error" : preview.severity === "medium" ? "muted" : "ok"}>
              {severityLabels[preview.severity]}
            </StatusBadge>
          </p>
          <div>
            <p className="mb-1 text-sm font-medium">{labels.effectiveZ}</p>
            <ul className="text-sm text-neutral-700">
              {SENSITIVITIES.map((key) => (
                <li key={key}>
                  {copy.fields[`sensitivity_z_offset.${key}`].label}: <strong>{formatDecimal(effectiveZ(settings, key), 1, 2)}</strong>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-neutral-500">{labels.effectiveZNote}</p>
          </div>
          <p className="text-xs text-neutral-500">{labels.cooldownNote(settings.cooldown_minutes)}</p>
          <ImpersonationPreview settings={settings} />
        </div>
      ) : (
        <p className="text-sm text-neutral-500">{labels.unavailable}</p>
      )}
    </Section>
  );
}

function ImpersonationPreview({ settings }: { settings: DetectionSettings }) {
  const [similarity, setSimilarity] = useState(settings.impersonation_threshold);
  const [young, setYoung] = useState(true);
  const labels = copy.preview;
  const result = previewImpersonation(settings, similarity, young);

  return (
    <div>
      <p className="mb-1 text-sm font-medium">{labels.impersonationTitle}</p>
      <p className="mb-2 text-xs text-neutral-500">{labels.impersonationFormula}</p>
      <div className="mb-2 grid gap-4 sm:grid-cols-2">
        <Field label={labels.similarity}>
          <input
            type="number"
            name="preview_similarity"
            min={0}
            max={1}
            step={0.01}
            value={similarity}
            onChange={(e) => setSimilarity(e.target.value === "" ? 0 : Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" name="preview_young" checked={young} onChange={(e) => setYoung(e.target.checked)} />
          {labels.youngAccount}
        </label>
      </div>
      <p className="text-sm">
        {labels.score}: <strong>{result.score}</strong> · {labels.severity}:{" "}
        <StatusBadge tone={result.severity === "high" ? "error" : result.severity === "medium" ? "muted" : "ok"}>
          {severityLabels[result.severity]}
        </StatusBadge>{" "}
        · {labels.similarityPoints}: {formatDecimal(result.similarityPoints, 1, 1)} · {labels.youngPoints}: {result.youngPoints}
      </p>
    </div>
  );
}
