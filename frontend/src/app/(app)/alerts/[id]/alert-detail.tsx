"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useCan, useMe } from "@/components/permissions-provider";
import { Button, ErrorText, Field, inputClass, PageTitle, Section, StatusBadge, Table, Td } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { availableActions, type AlertActionKey } from "@/lib/alert-actions";
import { summarizeEvidence } from "@/lib/coordination";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import {
  alertActionLabels,
  alertKindLabels,
  alertStatusLabels,
  evidenceReasonLabels,
  severityLabels,
  ui,
} from "@/lib/labels";
import { useApiData } from "@/lib/use-api-data";

type EvidenceItem = {
  id: number;
  reason: keyof typeof evidenceReasonLabels;
  account: { id: number; handle: string } | null;
  post: { id: number; text: string; is_simulated?: boolean } | null;
  detail: Record<string, unknown>;
};

type ActionItem = {
  action: keyof typeof alertActionLabels;
  from_status: string;
  to_status: string | null;
  user: string | null;
  note: string | null;
  created_at: string;
};

type ScoreBreakdown = {
  spike?: { raw: number; weight: number; value: number };
  anomaly?: { raw: number; weight: number; value: number };
  sentiment?: { raw: number; weight: number; value: number };
  reach?: { raw: number; weight: number; value: number };
  thresholds?: Record<string, unknown>;
};

type AlertDetailData = {
  id: number;
  kind: keyof typeof alertKindLabels;
  status: keyof typeof alertStatusLabels;
  score: number;
  severity: keyof typeof severityLabels;
  topic: { id: number; name: string } | null;
  subject_account: { id: number; handle: string } | null;
  score_breakdown: ScoreBreakdown | null;
  detected_at: string;
  recommendation: string | null;
  evidence?: EvidenceItem[];
  actions?: ActionItem[];
};

const BREAKDOWN_ROWS: { key: keyof Omit<ScoreBreakdown, "thresholds">; label: string }[] = [
  { key: "spike", label: ui.alerts.spike },
  { key: "anomaly", label: ui.alerts.anomaly },
  { key: "sentiment", label: ui.alerts.sentiment },
  { key: "reach", label: ui.alerts.reach },
];

export function AlertDetail({ id }: { id: number }) {
  const can = useCan();
  const me = useMe();
  const { data, error, reload } = useApiData<{ data: AlertDetailData }>(`alerts/${id}`);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [briefingMsg, setBriefingMsg] = useState<string | null>(null);

  if (error) {
    return <ErrorText>{ui.common.loadError}</ErrorText>;
  }

  if (data === null) {
    return <p className="text-sm text-ink-muted">{ui.loading}</p>;
  }

  const alert = data.data;
  const actions = availableActions(me.permissions, alert.status);
  const has = (action: AlertActionKey) => actions.includes(action);
  const isHigh = alert.severity === "high";

  async function handleAction(endpoint: string, payload: Record<string, unknown> = {}) {
    setBusyAction(endpoint);
    setFormError(null);
    try {
      await api(`alerts/${id}/${endpoint}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      reload();
    } catch (err) {
      if (err instanceof ApiError && err.body?.message) {
        setFormError(err.body.message);
      } else {
        setFormError(ui.common.actionError);
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateBriefing() {
    setBusyAction("briefings");
    setFormError(null);
    setBriefingMsg(null);
    try {
      await api(`alerts/${id}/briefings`, { method: "POST" });
      setBriefingMsg(ui.briefings.createSuccess);
      reload();
    } catch (err) {
      if (err instanceof ApiError && err.body?.message) {
        setFormError(err.body.message);
      } else {
        setFormError(ui.common.actionError);
      }
    } finally {
      setBusyAction(null);
    }
  }

  function submitEscalate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const recommendation = String(fd.get("recommendation") ?? "").trim();
    const note = String(fd.get("note") ?? "").trim();
    if (!recommendation) return;
    handleAction("escalate", { recommendation, note: note || undefined });
  }

  function submitNoteAction(e: FormEvent<HTMLFormElement>, actionKey: string) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const note = String(fd.get("note") ?? "").trim();
    if (!note && actionKey !== "approve") return;
    handleAction(actionKey, { note });
  }

  function submitComment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const note = String(fd.get("note") ?? "").trim();
    if (!note) return;
    handleAction("comments", { note });
  }

  const isSimulated = alert.evidence?.some((ev) => ev.post?.is_simulated);
  const subject = alert.topic?.name ?? alert.subject_account?.handle ?? ui.common.none;

  return (
    <div className="space-y-6">
      {/* Header: judul, status, dan skor. Severity tinggi memakai glow alert. */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div className="min-w-0">
          <Link href="/alerts" className="text-caption text-ink-muted hover:underline">
            ← {ui.alerts.backToList}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <PageTitle>
              {ui.alerts.detailTitle} #{alert.id}
            </PageTitle>
            <StatusBadge tone={alert.severity === "high" ? "error" : alert.severity === "medium" ? "warn" : "muted"}>
              {severityLabels[alert.severity] ?? alert.severity}
            </StatusBadge>
            <StatusBadge tone={alert.status === "escalated" || alert.status === "new" ? "error" : "muted"}>
              {alertStatusLabels[alert.status] ?? alert.status}
            </StatusBadge>
            {isSimulated ? <StatusBadge tone="muted">{ui.simulatedData}</StatusBadge> : null}
          </div>
          <p className="mt-1 text-sm font-medium text-ink">
            {subject} · <span className="font-normal text-ink-muted">{alertKindLabels[alert.kind] ?? alert.kind}</span>
          </p>
        </div>

        <div
          className={cn(
            "rounded-control border border-line bg-panel px-5 py-3 text-right",
            isHigh && "border-sev-high shadow-glow-alert",
          )}
        >
          <p className="text-caption text-ink-muted">{ui.alerts.score}</p>
          <p className="font-mono text-metric font-semibold tabular-nums text-ink">{alert.score}</p>
        </div>
      </div>

      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {briefingMsg ? <p className="text-sm text-brand">{briefingMsg}</p> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Kolom utama: rekomendasi, bukti, skor, riwayat */}
        <div className="min-w-0 space-y-6">
          {alert.recommendation ? (
            <blockquote className="rounded-control border border-line bg-panel p-4 pl-5">
              <p className="mb-1 text-caption font-medium uppercase tracking-wide text-brand">
                {ui.alerts.recommendation}
              </p>
              <p className="font-serif text-lead text-ink">{alert.recommendation}</p>
            </blockquote>
          ) : null}

          {alert.score_breakdown ? (
            <Section title={ui.alerts.scoreBreakdown}>
              <Table head={[ui.alerts.reason, ui.alerts.raw, ui.alerts.weight, ui.alerts.value]}>
                {BREAKDOWN_ROWS.map(({ key, label }) => {
                  const part = alert.score_breakdown?.[key];
                  if (!part) return null;
                  return (
                    <tr key={key}>
                      <Td className="font-medium">{label}</Td>
                      <Td className="font-mono text-caption">{part.raw}</Td>
                      <Td className="font-mono text-caption">{part.weight}%</Td>
                      <Td className="font-mono text-caption font-semibold">{part.value}</Td>
                    </tr>
                  );
                })}
              </Table>
              {alert.score_breakdown.thresholds ? (
                <p className="mt-2 break-all font-mono text-caption text-ink-muted">
                  {ui.alerts.thresholds}: {JSON.stringify(alert.score_breakdown.thresholds)}
                </p>
              ) : null}
            </Section>
          ) : null}

          <Section title={ui.alerts.evidence}>
            {!alert.evidence || alert.evidence.length === 0 ? (
              <p className="text-sm text-ink-muted">{ui.alerts.noEvidence}</p>
            ) : (
              <Table head={[ui.alerts.reason, ui.alerts.account, ui.alerts.postSnippet, ui.alerts.detail]}>
                {alert.evidence.map((ev) => (
                  <tr key={ev.id}>
                    <Td className="font-medium">{evidenceReasonLabels[ev.reason] ?? ev.reason}</Td>
                    <Td className="font-mono text-caption">{ev.account?.handle ?? ui.common.none}</Td>
                    <Td className="max-w-md text-caption">
                      {ev.post?.text ?? ui.common.none}
                      {ev.post?.is_simulated ? (
                        <span className="ml-1 text-ink-muted">({ui.simulatedData})</span>
                      ) : null}
                    </Td>
                    <Td className="max-w-xs break-words text-caption">
                      {summarizeEvidence(ev.reason, ev.detail) ? (
                        <p className="mb-1">{summarizeEvidence(ev.reason, ev.detail)}</p>
                      ) : null}
                      {ev.detail ? (
                        <details>
                          <summary className="cursor-pointer text-ink-muted">{ui.coordination.evidence.raw}</summary>
                          <code className="font-mono">{JSON.stringify(ev.detail)}</code>
                        </details>
                      ) : (
                        ui.common.none
                      )}
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>

          <Section title={ui.alerts.timeline}>
            {!alert.actions || alert.actions.length === 0 ? (
              <p className="text-sm text-ink-muted">{ui.common.empty}</p>
            ) : (
              <ol className="space-y-3 border-l border-line pl-4">
                {alert.actions.map((act, idx) => (
                  <li key={idx} className="rounded-control border border-line bg-panel p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-ink">
                        {alertActionLabels[act.action] ?? act.action} ·{" "}
                        <span className="font-normal text-ink-muted">{act.user ?? ui.audit.system}</span>
                      </span>
                      <span className="font-mono text-caption text-ink-muted">{formatDateTime(act.created_at)}</span>
                    </div>
                    {act.note ? <p className="mt-1 text-ink">{act.note}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        {/* Panel keputusan: sticky di lebar lg, hanya aksi yang tersedia untuk status ini. */}
        <aside
          aria-label={ui.alerts.action}
          className="space-y-4 rounded-control border border-line bg-panel p-4 lg:sticky lg:top-6"
        >
          <h2 className="text-section font-semibold text-ink">{ui.alerts.action}</h2>

          {alert.status !== "new" && can("briefings.create") ? (
            <Button
              variant="secondary"
              className="w-full"
              disabled={busyAction === "briefings"}
              onClick={handleCreateBriefing}
            >
              {busyAction === "briefings" ? ui.alerts.generatingBriefing : ui.alerts.generateBriefing}
            </Button>
          ) : null}

          {has("take") ? (
            <Button
              variant="primary"
              className="w-full"
              disabled={busyAction === "take"}
              onClick={() => handleAction("take")}
            >
              {busyAction === "take" ? ui.alerts.taking : ui.alerts.take}
            </Button>
          ) : null}

          {has("escalate") ? (
            <form onSubmit={submitEscalate} className="space-y-2 border-t border-line pt-4">
              <Field label={ui.alerts.recommendation}>
                <textarea
                  name="recommendation"
                  rows={2}
                  required
                  placeholder={ui.alerts.recommendationPlaceholder}
                  className={inputClass}
                />
              </Field>
              <Field label={ui.alerts.note}>
                <input name="note" type="text" placeholder={ui.alerts.notePlaceholder} className={inputClass} />
              </Field>
              <Button type="submit" variant="primary" className="w-full" disabled={busyAction === "escalate"}>
                {busyAction === "escalate" ? ui.alerts.escalating : ui.alerts.escalate}
              </Button>
            </form>
          ) : null}

          {has("false-positive") ? (
            <form
              onSubmit={(e) => submitNoteAction(e, "false-positive")}
              className="space-y-2 border-t border-line pt-4"
            >
              <Field label={ui.alerts.falsePositive}>
                <input name="note" type="text" required placeholder={ui.alerts.notePlaceholder} className={inputClass} />
              </Field>
              <Button type="submit" variant="secondary" className="w-full" disabled={busyAction === "false-positive"}>
                {busyAction === "false-positive" ? ui.alerts.closingFp : ui.alerts.falsePositive}
              </Button>
            </form>
          ) : null}

          {has("close") ? (
            <form onSubmit={(e) => submitNoteAction(e, "close")} className="space-y-2 border-t border-line pt-4">
              <Field label={ui.alerts.close}>
                <input name="note" type="text" required placeholder={ui.alerts.notePlaceholder} className={inputClass} />
              </Field>
              <Button type="submit" variant="secondary" className="w-full" disabled={busyAction === "close"}>
                {busyAction === "close" ? ui.alerts.closing : ui.alerts.close}
              </Button>
            </form>
          ) : null}

          {has("approve") ? (
            <form onSubmit={(e) => submitNoteAction(e, "approve")} className="space-y-2 border-t border-line pt-4">
              <Field label={ui.alerts.approve}>
                <input name="note" type="text" placeholder={ui.alerts.notePlaceholder} className={inputClass} />
              </Field>
              <Button type="submit" variant="primary" className="w-full" disabled={busyAction === "approve"}>
                {busyAction === "approve" ? ui.alerts.approving : ui.alerts.approve}
              </Button>
            </form>
          ) : null}

          {has("return") ? (
            <form onSubmit={(e) => submitNoteAction(e, "return")} className="space-y-2 border-t border-line pt-4">
              <Field label={ui.alerts.return}>
                <textarea name="note" rows={2} required placeholder={ui.alerts.notePlaceholder} className={inputClass} />
              </Field>
              <Button type="submit" variant="secondary" className="w-full" disabled={busyAction === "return"}>
                {busyAction === "return" ? ui.alerts.returning : ui.alerts.return}
              </Button>
            </form>
          ) : null}

          {has("comment") ? (
            <form onSubmit={submitComment} className="space-y-2 border-t border-line pt-4">
              <Field label={ui.alerts.addComment}>
                <textarea name="note" rows={2} required placeholder={ui.alerts.commentPlaceholder} className={inputClass} />
              </Field>
              <Button type="submit" variant="secondary" className="w-full" disabled={busyAction === "comments"}>
                {busyAction === "comments" ? ui.alerts.commenting : ui.alerts.comment}
              </Button>
            </form>
          ) : null}

          {actions.length === 0 ? (
            <p className="text-sm text-ink-muted">{ui.common.empty}</p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
