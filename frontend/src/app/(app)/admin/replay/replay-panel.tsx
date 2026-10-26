"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, ErrorText, Field, FieldErrors, inputClass, PageTitle, Section, StatusBadge, Table, Td } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, invalidFields } from "@/lib/format";
import { describeErrorCode, ui } from "@/lib/labels";
import { replayStatusLabels } from "@/lib/labels/replay";
import {
  isRunning,
  isValidSpeed,
  MAX_SPEED,
  MIN_SPEED,
  POLL_MS,
  progressPercent,
  statusTone,
  type ReplayListResponse,
  type ReplayScenario,
} from "@/lib/replay";
import { useApiData } from "@/lib/use-api-data";

const copy = ui.replay;

/** 409/422 bodies carry error codes (see labels.replayErrorCodes); anything else is a generic failure. */
function errorMessages(e: unknown): string {
  if (e instanceof ApiError && (e.status === 409 || e.status === 422)) {
    const codes = Object.values(e.body?.errors ?? {}).flat();
    if (codes.length > 0) return codes.map(describeErrorCode).join("; ");
  }
  return ui.common.actionError;
}

export function ReplayPanel() {
  const { data, error, reload } = useApiData<ReplayListResponse>("replay/scenarios");
  const anyRunning = data?.data.some(isRunning) ?? false;

  // While a scenario runs the page follows its progress; an idle page does not poll.
  useEffect(() => {
    if (!anyRunning) return;
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [anyRunning, reload]);

  return (
    <>
      <PageTitle>{copy.title}</PageTitle>
      <p className="mb-2 max-w-3xl text-sm text-neutral-600">{copy.intro}</p>
      <p className="mb-4 max-w-3xl text-xs text-neutral-500">{copy.workers}</p>
      <ErrorText>{error ? ui.common.loadError : null}</ErrorText>

      {data === null ? (
        <p className="text-sm text-neutral-500">{ui.loading}</p>
      ) : (
        <>
          <p className="mb-3 text-sm">
            {data.meta.clock_now ? (
              <StatusBadge tone="warn">{copy.clockActive(formatDateTime(data.meta.clock_now))}</StatusBadge>
            ) : (
              <span className="text-neutral-500">{copy.clockIdle}</span>
            )}
          </p>
          <Section title={copy.scenarios}>
            {data.data.length === 0 ? (
              <p className="text-sm text-neutral-500">{copy.empty}</p>
            ) : (
              <Table
                head={[copy.columns.name, copy.columns.status, copy.columns.progress, copy.columns.speed, copy.columns.times, copy.columns.actions]}
              >
                {data.data.map((scenario) => (
                  <ScenarioRow key={scenario.id} scenario={scenario} anotherRunning={anyRunning && !isRunning(scenario)} onChanged={reload} />
                ))}
              </Table>
            )}
          </Section>
        </>
      )}

      <Section title={copy.upload.title}>
        <UploadForm onCreated={reload} />
      </Section>
    </>
  );
}

function ScenarioRow({ scenario, anotherRunning, onChanged }: { scenario: ReplayScenario; anotherRunning: boolean; onChanged: () => void }) {
  const [speed, setSpeed] = useState(String(scenario.default_speed_factor));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = isRunning(scenario);
  const percent = progressPercent(scenario);

  async function act(path: string, body?: object) {
    setBusy(true);
    setError(null);
    try {
      await api(`replay/scenarios/${scenario.id}/${path}`, { method: "POST", body: body ? JSON.stringify(body) : undefined });
      onChanged();
    } catch (e) {
      setError(errorMessages(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <Td>
        <div className="font-medium">{scenario.name}</div>
        {scenario.description && <div className="text-xs text-neutral-500">{scenario.description}</div>}
        <div className="text-xs text-neutral-500">
          {copy.rowsCount(scenario.total_rows, String(scenario.incident_start_offset_seconds ?? ui.common.none))}
        </div>
        <StatusBadge tone="muted">{ui.simulatedData}</StatusBadge>
      </Td>
      <Td>
        <StatusBadge tone={statusTone(scenario)}>{replayStatusLabels[scenario.status]}</StatusBadge>
        {scenario.run_number > 0 && <div className="mt-1 text-xs text-neutral-500">{copy.runNumber(scenario.run_number)}</div>}
        {scenario.error && (
          <div className="mt-1 break-words text-xs text-red-700">
            {copy.error}: {scenario.error}
          </div>
        )}
      </Td>
      <Td>
        <div className="h-2 w-32 overflow-hidden rounded bg-neutral-200" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-neutral-800" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-1 text-xs text-neutral-600">{copy.progress(scenario.progress_rows, scenario.total_rows)}</div>
      </Td>
      <Td>{scenario.speed_factor ? copy.speedValue(scenario.speed_factor) : ui.common.none}</Td>
      <Td className="text-xs text-neutral-600">
        {scenario.virtual_anchor_at && <div>{copy.anchor(formatDateTime(scenario.virtual_anchor_at))}</div>}
        {scenario.started_at && <div>{copy.started(formatDateTime(scenario.started_at))}</div>}
        {scenario.finished_at && <div>{copy.finished(formatDateTime(scenario.finished_at))}</div>}
      </Td>
      <Td>
        {running ? (
          <Button
            disabled={busy}
            onClick={() => {
              if (window.confirm(copy.stopConfirm)) void act("stop");
            }}
          >
            {busy ? copy.stopping : copy.stop}
          </Button>
        ) : (
          <div className="flex items-end gap-2">
            <label className="block text-xs text-neutral-600" title={copy.speedHint}>
              {copy.speedLabel}
              <input
                name="speed_factor"
                inputMode="numeric"
                value={speed}
                onChange={(e) => setSpeed(e.target.value)}
                aria-invalid={!isValidSpeed(speed)}
                className={`${inputClass} mt-1 w-24`}
              />
            </label>
            <Button variant="primary" disabled={busy || anotherRunning || !isValidSpeed(speed)} onClick={() => act("start", { speed_factor: Number(speed) })}>
              {busy ? copy.starting : copy.start}
            </Button>
          </div>
        )}
        {!running && !isValidSpeed(speed) && (
          <p className="mt-1 text-xs text-red-700">
            {MIN_SPEED}–{MAX_SPEED}
          </p>
        )}
        <ErrorText>{error}</ErrorText>
      </Td>
    </tr>
  );
}

function UploadForm({ onCreated }: { onCreated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<string[]>([]);
  const [rows, setRows] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError(null);
    setFields([]);
    setRows([]);
    setDone(null);
    try {
      const result = await api<{ data: ReplayScenario }>("replay/scenarios", { method: "POST", body: new FormData(form) });
      setDone(copy.upload.done(result.data.name));
      form.reset();
      onCreated();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setFields(invalidFields(e.body).filter((f) => f !== "file" && f !== "rows"));
        setError(errorMessages(e));
        setRows(e.body?.errors?.rows ?? []);
      } else {
        setError(ui.common.actionError);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-3">
      <p className="text-xs text-neutral-500">{copy.upload.format}</p>
      <Field label={copy.upload.file}>
        <input name="file" type="file" accept=".csv,text/csv" required className="text-sm" />
      </Field>
      <Field label={copy.upload.name}>
        <input name="name" required maxLength={150} className={inputClass} />
      </Field>
      <Field label={copy.upload.description}>
        <input name="description" maxLength={2000} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={copy.upload.incidentStart}>
          <input name="incident_start_offset_seconds" inputMode="numeric" className={inputClass} />
        </Field>
        <Field label={copy.upload.defaultSpeed}>
          <input name="default_speed_factor" inputMode="numeric" placeholder="60" className={inputClass} />
        </Field>
      </div>
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? copy.upload.submitting : copy.upload.submit}
      </Button>
      <ErrorText>{error}</ErrorText>
      <FieldErrors fields={fields} />
      {rows.length > 0 && (
        <div>
          <Table head={[copy.upload.row, copy.upload.problem]}>
            {rows.map((entry) => {
              const colon = entry.indexOf(":");
              const line = entry.slice(0, colon);
              const code = entry.slice(colon + 1);
              return (
                <tr key={entry}>
                  <Td>{line}</Td>
                  <Td>{describeErrorCode(code)}</Td>
                </tr>
              );
            })}
          </Table>
          {rows.length >= 50 && <p className="mt-1 text-xs text-neutral-500">{copy.upload.rowsTruncated}</p>}
        </div>
      )}
      {done && <p className="text-sm text-green-700">{done}</p>}
    </form>
  );
}
