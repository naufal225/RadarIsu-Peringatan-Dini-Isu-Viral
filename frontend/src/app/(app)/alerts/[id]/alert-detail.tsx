"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useCan } from "@/components/permissions-provider";
import { Button, ErrorText, Field, inputClass, PageTitle, Section, StatusBadge, Table, Td } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { summarizeEvidence } from "@/lib/coordination";
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

export function AlertDetail({ id }: { id: number }) {
  const can = useCan();
  const { data, error, reload } = useApiData<{ data: AlertDetailData }>(`alerts/${id}`);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [briefingMsg, setBriefingMsg] = useState<string | null>(null);

  if (error) {
    return <ErrorText>{ui.common.loadError}</ErrorText>;
  }

  if (data === null) {
    return <p className="text-sm text-neutral-500">{ui.loading}</p>;
  }

  const alert = data.data;

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

  function getSeverityTone(sev: keyof typeof severityLabels): "error" | "ok" | "muted" {
    if (sev === "high") return "error";
    if (sev === "medium") return "muted";
    return "ok";
  }

  function getStatusTone(st: keyof typeof alertStatusLabels): "error" | "ok" | "muted" {
    if (st === "escalated" || st === "new") return "error";
    if (st === "approved") return "ok";
    return "muted";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/alerts" className="text-xs text-neutral-500 hover:underline">
              ← {ui.alerts.backToList}
            </Link>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <PageTitle>
              {ui.alerts.detailTitle} #{alert.id}
            </PageTitle>
            <StatusBadge tone={getSeverityTone(alert.severity)}>
              {severityLabels[alert.severity] ?? alert.severity}
            </StatusBadge>
            <StatusBadge tone={getStatusTone(alert.status)}>
              {alertStatusLabels[alert.status] ?? alert.status}
            </StatusBadge>
            {isSimulated ? <StatusBadge tone="muted">{ui.simulatedData}</StatusBadge> : null}
          </div>
          <p className="text-sm font-medium text-neutral-700">
            {alert.topic?.name ?? alert.subject_account?.handle ?? ui.common.none} ·{" "}
            <span className="text-neutral-500">{alertKindLabels[alert.kind] ?? alert.kind}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-neutral-500">{ui.alerts.score}</p>
            <p className="text-2xl font-bold">{alert.score}</p>
          </div>

          {alert.status !== "new" && can("briefings.create") ? (
            <Button
              variant="secondary"
              disabled={busyAction === "briefings"}
              onClick={handleCreateBriefing}
            >
              {busyAction === "briefings" ? ui.alerts.generatingBriefing : ui.alerts.generateBriefing}
            </Button>
          ) : null}
        </div>
      </div>

      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {briefingMsg ? <p className="text-sm text-green-700">{briefingMsg}</p> : null}

      {/* Rekomendasi Terakhir */}
      {alert.recommendation ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900">{ui.alerts.recommendation}</h3>
          <p className="mt-1 text-sm text-amber-800">{alert.recommendation}</p>
        </div>
      ) : null}

      {/* Rincian Skor Ancaman */}
      {alert.score_breakdown ? (
        <Section title={ui.alerts.scoreBreakdown}>
          <Table head={[ui.alerts.reason, ui.alerts.raw, ui.alerts.weight, ui.alerts.value]}>
            {alert.score_breakdown.spike ? (
              <tr>
                <Td className="font-medium">{ui.alerts.spike}</Td>
                <Td className="font-mono text-xs">{alert.score_breakdown.spike.raw}</Td>
                <Td className="font-mono text-xs">{alert.score_breakdown.spike.weight}%</Td>
                <Td className="font-mono text-xs font-semibold">{alert.score_breakdown.spike.value}</Td>
              </tr>
            ) : null}
            {alert.score_breakdown.anomaly ? (
              <tr>
                <Td className="font-medium">{ui.alerts.anomaly}</Td>
                <Td className="font-mono text-xs">{alert.score_breakdown.anomaly.raw}</Td>
                <Td className="font-mono text-xs">{alert.score_breakdown.anomaly.weight}%</Td>
                <Td className="font-mono text-xs font-semibold">{alert.score_breakdown.anomaly.value}</Td>
              </tr>
            ) : null}
            {alert.score_breakdown.sentiment ? (
              <tr>
                <Td className="font-medium">{ui.alerts.sentiment}</Td>
                <Td className="font-mono text-xs">{alert.score_breakdown.sentiment.raw}</Td>
                <Td className="font-mono text-xs">{alert.score_breakdown.sentiment.weight}%</Td>
                <Td className="font-mono text-xs font-semibold">{alert.score_breakdown.sentiment.value}</Td>
              </tr>
            ) : null}
            {alert.score_breakdown.reach ? (
              <tr>
                <Td className="font-medium">{ui.alerts.reach}</Td>
                <Td className="font-mono text-xs">{alert.score_breakdown.reach.raw}</Td>
                <Td className="font-mono text-xs">{alert.score_breakdown.reach.weight}%</Td>
                <Td className="font-mono text-xs font-semibold">{alert.score_breakdown.reach.value}</Td>
              </tr>
            ) : null}
          </Table>

          {alert.score_breakdown.thresholds ? (
            <p className="mt-2 text-xs text-neutral-500">
              {ui.alerts.thresholds}: {JSON.stringify(alert.score_breakdown.thresholds)}
            </p>
          ) : null}
        </Section>
      ) : null}

      {/* Bukti Terlampir */}
      <Section title={ui.alerts.evidence}>
        {!alert.evidence || alert.evidence.length === 0 ? (
          <p className="text-sm text-neutral-500">{ui.alerts.noEvidence}</p>
        ) : (
          <Table head={[ui.alerts.reason, ui.alerts.account, ui.alerts.postSnippet, ui.alerts.detail]}>
            {alert.evidence.map((ev) => (
              <tr key={ev.id}>
                <Td className="font-medium">
                  {evidenceReasonLabels[ev.reason] ?? ev.reason}
                </Td>
                <Td className="font-mono text-xs">
                  {ev.account?.handle ?? ui.common.none}
                </Td>
                <Td className="max-w-md text-xs">
                  {ev.post?.text ?? ui.common.none}
                  {ev.post?.is_simulated ? (
                    <span className="ml-1 text-neutral-400">({ui.simulatedData})</span>
                  ) : null}
                </Td>
                <Td className="max-w-xs break-words text-xs">
                  {summarizeEvidence(ev.reason, ev.detail) ? <p className="mb-1">{summarizeEvidence(ev.reason, ev.detail)}</p> : null}
                  {ev.detail ? (
                    <details>
                      <summary className="cursor-pointer text-neutral-500">{ui.coordination.evidence.raw}</summary>
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

      {/* Riwayat Penanganan (Timeline) */}
      <Section title={ui.alerts.timeline}>
        {!alert.actions || alert.actions.length === 0 ? (
          <p className="text-sm text-neutral-500">{ui.common.empty}</p>
        ) : (
          <div className="space-y-3">
            {alert.actions.map((act, idx) => (
              <div key={idx} className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-neutral-900">
                    {alertActionLabels[act.action] ?? act.action} ·{" "}
                    <span className="font-normal text-neutral-600">{act.user ?? ui.audit.system}</span>
                  </span>
                  <span className="text-xs text-neutral-500">{formatDateTime(act.created_at)}</span>
                </div>
                {act.note ? <p className="mt-1 text-neutral-700">{act.note}</p> : null}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Operasi Triase Sesuai Peran */}
      <Section title={ui.alerts.action}>
        <div className="space-y-4 rounded-md border border-neutral-200 p-4">
          {/* Analyst Operations */}
          {can("alerts.triage") ? (
            <>
              {alert.status === "new" ? (
                <div>
                  <Button
                    variant="primary"
                    disabled={busyAction === "take"}
                    onClick={() => handleAction("take")}
                  >
                    {busyAction === "take" ? ui.alerts.taking : ui.alerts.take}
                  </Button>
                </div>
              ) : null}

              {alert.status === "reviewing" || alert.status === "returned" ? (
                <div className="space-y-4">
                  {/* Form Eskalasi */}
                  <form onSubmit={submitEscalate} className="space-y-2 border-b border-neutral-200 pb-4">
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
                      <input
                        name="note"
                        type="text"
                        placeholder={ui.alerts.notePlaceholder}
                        className={inputClass}
                      />
                    </Field>
                    <Button type="submit" variant="primary" disabled={busyAction === "escalate"}>
                      {busyAction === "escalate" ? ui.alerts.escalating : ui.alerts.escalate}
                    </Button>
                  </form>

                  {/* Form Positif Palsu */}
                  <form
                    onSubmit={(e) => submitNoteAction(e, "false-positive")}
                    className="flex flex-wrap items-end gap-2 border-b border-neutral-200 pb-4"
                  >
                    <div className="flex-1">
                      <Field label={ui.alerts.falsePositive}>
                        <input
                          name="note"
                          type="text"
                          required
                          placeholder={ui.alerts.notePlaceholder}
                          className={inputClass}
                        />
                      </Field>
                    </div>
                    <Button type="submit" variant="secondary" disabled={busyAction === "false-positive"}>
                      {busyAction === "false-positive" ? ui.alerts.closingFp : ui.alerts.falsePositive}
                    </Button>
                  </form>

                  {/* Form Tutup Isu */}
                  <form
                    onSubmit={(e) => submitNoteAction(e, "close")}
                    className="flex flex-wrap items-end gap-2 border-b border-neutral-200 pb-4"
                  >
                    <div className="flex-1">
                      <Field label={ui.alerts.close}>
                        <input
                          name="note"
                          type="text"
                          required
                          placeholder={ui.alerts.notePlaceholder}
                          className={inputClass}
                        />
                      </Field>
                    </div>
                    <Button type="submit" variant="secondary" disabled={busyAction === "close"}>
                      {busyAction === "close" ? ui.alerts.closing : ui.alerts.close}
                    </Button>
                  </form>
                </div>
              ) : null}
            </>
          ) : null}

          {/* Leader Operations */}
          {can("alerts.decide") && alert.status === "escalated" ? (
            <div className="space-y-4">
              {/* Form Approve */}
              <form
                onSubmit={(e) => submitNoteAction(e, "approve")}
                className="flex flex-wrap items-end gap-2 border-b border-neutral-200 pb-4"
              >
                <div className="flex-1">
                  <Field label={ui.alerts.approve}>
                    <input
                      name="note"
                      type="text"
                      placeholder={ui.alerts.notePlaceholder}
                      className={inputClass}
                    />
                  </Field>
                </div>
                <Button type="submit" variant="primary" disabled={busyAction === "approve"}>
                  {busyAction === "approve" ? ui.alerts.approving : ui.alerts.approve}
                </Button>
              </form>

              {/* Form Return */}
              <form
                onSubmit={(e) => submitNoteAction(e, "return")}
                className="space-y-2 border-b border-neutral-200 pb-4"
              >
                <Field label={ui.alerts.return}>
                  <textarea
                    name="note"
                    rows={2}
                    required
                    placeholder={ui.alerts.notePlaceholder}
                    className={inputClass}
                  />
                </Field>
                <Button type="submit" variant="secondary" disabled={busyAction === "return"}>
                  {busyAction === "return" ? ui.alerts.returning : ui.alerts.return}
                </Button>
              </form>
            </div>
          ) : null}

          {/* Comment Form (Allowed for any role that can view alert) */}
          <form onSubmit={submitComment} className="space-y-2">
            <Field label={ui.alerts.addComment}>
              <textarea
                name="note"
                rows={2}
                required
                placeholder={ui.alerts.commentPlaceholder}
                className={inputClass}
              />
            </Field>
            <Button type="submit" variant="secondary" disabled={busyAction === "comments"}>
              {busyAction === "comments" ? ui.alerts.commenting : ui.alerts.comment}
            </Button>
          </form>
        </div>
      </Section>
    </div>
  );
}
