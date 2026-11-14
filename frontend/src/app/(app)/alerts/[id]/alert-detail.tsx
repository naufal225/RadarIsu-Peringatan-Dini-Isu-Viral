"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useCan, useMe } from "@/components/permissions-provider";
import { Button } from "@/components/radar/button";
import { DataTable, type DataTableColumn } from "@/components/radar/data-table";
import { controlClass, Field, FieldError } from "@/components/radar/form";
import { Section } from "@/components/radar/section";
import { Tag } from "@/components/radar/tag";
import { Waktu } from "@/components/radar/waktu";
import { api, ApiError } from "@/lib/api";
import { availableActions, type AlertActionKey } from "@/lib/alert-actions";
import { summarizeEvidence } from "@/lib/coordination";
import { cn } from "@/lib/cn";
import { evidenceComposition } from "@/lib/insight";
import { formatInteger } from "@/lib/format";
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

type Part = { raw: number; weight: number; value: number };

type ScoreBreakdown = {
  spike?: Part;
  anomaly?: Part;
  sentiment?: Part;
  reach?: Part;
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

type BreakdownRow = { key: string; label: string; part: Part };

const BREAKDOWN_LABELS: { key: keyof Omit<ScoreBreakdown, "thresholds">; label: string }[] = [
  { key: "spike", label: ui.alerts.spike },
  { key: "anomaly", label: ui.alerts.anomaly },
  { key: "sentiment", label: ui.alerts.sentiment },
  { key: "reach", label: ui.alerts.reach },
];

/** Bukti yang tampil di awal; sisanya lewat "Tampilkan semua". */
const EVIDENCE_PREVIEW = 8;

const BREAKDOWN_COLUMNS: DataTableColumn<BreakdownRow>[] = [
  { id: "reason", header: ui.alerts.reason, cell: (r) => <span className="font-medium text-ink">{r.label}</span> },
  { id: "raw", header: ui.alerts.raw, mono: true, align: "right", cell: (r) => r.part.raw },
  { id: "weight", header: ui.alerts.weight, mono: true, align: "right", cell: (r) => `${r.part.weight}%` },
  { id: "value", header: ui.alerts.value, mono: true, align: "right", cell: (r) => <span className="font-semibold">{r.part.value}</span> },
];

const EVIDENCE_COLUMNS: DataTableColumn<EvidenceItem>[] = [
  {
    id: "reason",
    header: ui.alerts.reason,
    cell: (ev) => <span className="font-medium text-ink">{evidenceReasonLabels[ev.reason] ?? ev.reason}</span>,
  },
  { id: "account", header: ui.alerts.account, mono: true, cell: (ev) => ev.account?.handle ?? ui.common.none },
  {
    id: "post",
    header: ui.alerts.postSnippet,
    cell: (ev) => (
      <span className="block max-w-md break-words">
        {ev.post?.text ?? ui.common.none}
        {ev.post?.is_simulated && <span className="ml-1 text-ink-muted">({ui.simulatedData})</span>}
      </span>
    ),
  },
  {
    id: "detail",
    header: ui.alerts.detail,
    cell: (ev) => {
      const summary = summarizeEvidence(ev.reason, ev.detail);
      return (
        <span className="block max-w-xs break-words text-caption">
          {summary && <span className="mb-1 block">{summary}</span>}
          {ev.detail ? (
            <details>
              <summary className="cursor-pointer text-ink-muted">{ui.coordination.evidence.raw}</summary>
              <code className="font-mono">{JSON.stringify(ev.detail)}</code>
            </details>
          ) : (
            ui.common.none
          )}
        </span>
      );
    },
  },
];

/** Ringkasan satu baris untuk bukti: berapa bukti, akun terlibat, akun baru, dan posting serentak. */
function EvidenceSummary({ evidence }: { evidence: EvidenceItem[] }) {
  const composition = evidenceComposition(evidence);
  const items = [
    { label: ui.alerts.evidence, value: composition.total },
    { label: ui.alerts.evidenceAccounts, value: composition.accounts },
    { label: ui.alerts.evidenceYoung, value: composition.youngAccounts },
    { label: ui.alerts.evidenceSynced, value: composition.synchronizedAccounts },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-control border border-line bg-hover px-3 py-2">
          <dt className="text-caption text-ink-muted">{item.label}</dt>
          <dd className="font-mono text-section font-semibold tabular-nums text-ink">{formatInteger(item.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function toneOf(severity: keyof typeof severityLabels): "danger" | "warn" | "muted" {
  if (severity === "high") return "danger";
  if (severity === "medium") return "warn";
  return "muted";
}

export function AlertDetail({ id }: { id: number }) {
  const can = useCan();
  const me = useMe();
  const { data, error, reload } = useApiData<{ data: AlertDetailData }>(`alerts/${id}`);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [briefingMsg, setBriefingMsg] = useState<string | null>(null);
  const [showAllEvidence, setShowAllEvidence] = useState(false);

  if (error) {
    return <FieldError>{ui.common.loadError}</FieldError>;
  }

  if (data === null) {
    return <p className="text-table text-ink-muted">{ui.loading}</p>;
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
  const breakdownRows: BreakdownRow[] = alert.score_breakdown
    ? BREAKDOWN_LABELS.flatMap(({ key, label }) => {
        const part = alert.score_breakdown?.[key];
        return part ? [{ key, label, part }] : [];
      })
    : [];

  return (
    <div className="space-y-6">
      {/* Header: judul, status, dan skor. Severity tinggi memakai glow alert. */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div className="min-w-0">
          <Link href="/alerts" className="text-caption text-ink-muted hover:underline">
            ← {ui.alerts.backToList}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-title text-ink">
              {ui.alerts.detailTitle} #{alert.id}
            </h1>
            <Tag tone={toneOf(alert.severity)}>{severityLabels[alert.severity] ?? alert.severity}</Tag>
            <Tag tone={alert.status === "escalated" || alert.status === "new" ? "danger" : "muted"}>
              {alertStatusLabels[alert.status] ?? alert.status}
            </Tag>
            {isSimulated && <Tag tone="muted">{ui.simulatedData}</Tag>}
          </div>
          <p className="mt-1 text-table font-medium text-ink">
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

      {formError && <FieldError>{formError}</FieldError>}
      {briefingMsg && <p className="text-table text-brand">{briefingMsg}</p>}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Kolom utama: rekomendasi, skor, bukti, riwayat */}
        <div className="min-w-0 space-y-6">
          {alert.recommendation && (
            <blockquote className="rounded-control border border-line bg-panel p-4 pl-5">
              <p className="mb-1 text-caption font-medium uppercase tracking-wide text-brand">{ui.alerts.recommendation}</p>
              <p className="font-serif text-lead text-ink">{alert.recommendation}</p>
            </blockquote>
          )}

          {alert.score_breakdown && (
            <Section title={ui.alerts.scoreBreakdown}>
              <DataTable caption={ui.alerts.scoreBreakdown} columns={BREAKDOWN_COLUMNS} rows={breakdownRows} getRowKey={(r) => r.key} framed={false} />
              {alert.score_breakdown.thresholds && (
                <p className="mt-2 break-all font-mono text-caption text-ink-muted">
                  {ui.alerts.thresholds}: {JSON.stringify(alert.score_breakdown.thresholds)}
                </p>
              )}
            </Section>
          )}

          <Section title={ui.alerts.evidence}>
            {!alert.evidence || alert.evidence.length === 0 ? (
              <p className="text-table text-ink-muted">{ui.alerts.noEvidence}</p>
            ) : (
              <div className="space-y-3">
                <EvidenceSummary evidence={alert.evidence} />
                <DataTable
                  caption={ui.alerts.evidence}
                  columns={EVIDENCE_COLUMNS}
                  rows={showAllEvidence ? alert.evidence : alert.evidence.slice(0, EVIDENCE_PREVIEW)}
                  getRowKey={(ev) => ev.id}
                  framed={false}
                />
                {alert.evidence.length > EVIDENCE_PREVIEW && (
                  <div className="flex items-center justify-between gap-3 text-caption text-ink-muted">
                    <span>
                      {formatInteger(showAllEvidence ? alert.evidence.length : EVIDENCE_PREVIEW)} / {formatInteger(alert.evidence.length)}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setShowAllEvidence((v) => !v)}>
                      {showAllEvidence ? ui.alerts.evidenceShowFewer : ui.alerts.evidenceShowAll}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section title={ui.alerts.timeline}>
            {!alert.actions || alert.actions.length === 0 ? (
              <p className="text-table text-ink-muted">{ui.common.empty}</p>
            ) : (
              <ol className="space-y-3 border-l border-line pl-4">
                {alert.actions.map((act, idx) => (
                  <li key={idx} className="rounded-control border border-line bg-panel p-3 text-table">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-ink">
                        {alertActionLabels[act.action] ?? act.action} ·{" "}
                        <span className="font-normal text-ink-muted">{act.user ?? ui.audit.system}</span>
                      </span>
                      <span className="text-caption text-ink-muted">
                        <Waktu value={act.created_at} />
                      </span>
                    </div>
                    {act.note && <p className="mt-1 text-ink">{act.note}</p>}
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

          {alert.status !== "new" && can("briefings.create") && (
            <Button variant="secondary" className="w-full" disabled={busyAction === "briefings"} onClick={handleCreateBriefing}>
              {busyAction === "briefings" ? ui.alerts.generatingBriefing : ui.alerts.generateBriefing}
            </Button>
          )}

          {has("take") && (
            <Button variant="primary" className="w-full" disabled={busyAction === "take"} onClick={() => handleAction("take")}>
              {busyAction === "take" ? ui.alerts.taking : ui.alerts.take}
            </Button>
          )}

          {has("escalate") && (
            <form onSubmit={submitEscalate} className="space-y-2 border-t border-line pt-4">
              <Field label={ui.alerts.recommendation}>
                <textarea name="recommendation" rows={2} required placeholder={ui.alerts.recommendationPlaceholder} className={controlClass} />
              </Field>
              <Field label={ui.alerts.note}>
                <input name="note" type="text" placeholder={ui.alerts.notePlaceholder} className={controlClass} />
              </Field>
              <Button type="submit" variant="primary" className="w-full" disabled={busyAction === "escalate"}>
                {busyAction === "escalate" ? ui.alerts.escalating : ui.alerts.escalate}
              </Button>
            </form>
          )}

          {has("false-positive") && (
            <form onSubmit={(e) => submitNoteAction(e, "false-positive")} className="space-y-2 border-t border-line pt-4">
              <Field label={ui.alerts.falsePositive}>
                <input name="note" type="text" required placeholder={ui.alerts.notePlaceholder} className={controlClass} />
              </Field>
              <Button type="submit" variant="secondary" className="w-full" disabled={busyAction === "false-positive"}>
                {busyAction === "false-positive" ? ui.alerts.closingFp : ui.alerts.falsePositive}
              </Button>
            </form>
          )}

          {has("close") && (
            <form onSubmit={(e) => submitNoteAction(e, "close")} className="space-y-2 border-t border-line pt-4">
              <Field label={ui.alerts.close}>
                <input name="note" type="text" required placeholder={ui.alerts.notePlaceholder} className={controlClass} />
              </Field>
              <Button type="submit" variant="secondary" className="w-full" disabled={busyAction === "close"}>
                {busyAction === "close" ? ui.alerts.closing : ui.alerts.close}
              </Button>
            </form>
          )}

          {has("approve") && (
            <form onSubmit={(e) => submitNoteAction(e, "approve")} className="space-y-2 border-t border-line pt-4">
              <Field label={ui.alerts.approve}>
                <input name="note" type="text" placeholder={ui.alerts.notePlaceholder} className={controlClass} />
              </Field>
              <Button type="submit" variant="primary" className="w-full" disabled={busyAction === "approve"}>
                {busyAction === "approve" ? ui.alerts.approving : ui.alerts.approve}
              </Button>
            </form>
          )}

          {has("return") && (
            <form onSubmit={(e) => submitNoteAction(e, "return")} className="space-y-2 border-t border-line pt-4">
              <Field label={ui.alerts.return}>
                <textarea name="note" rows={2} required placeholder={ui.alerts.notePlaceholder} className={controlClass} />
              </Field>
              <Button type="submit" variant="secondary" className="w-full" disabled={busyAction === "return"}>
                {busyAction === "return" ? ui.alerts.returning : ui.alerts.return}
              </Button>
            </form>
          )}

          {has("comment") && (
            <form onSubmit={submitComment} className="space-y-2 border-t border-line pt-4">
              <Field label={ui.alerts.addComment}>
                <textarea name="note" rows={2} required placeholder={ui.alerts.commentPlaceholder} className={controlClass} />
              </Field>
              <Button type="submit" variant="secondary" className="w-full" disabled={busyAction === "comments"}>
                {busyAction === "comments" ? ui.alerts.commenting : ui.alerts.comment}
              </Button>
            </form>
          )}

          {actions.length === 0 && <p className="text-table text-ink-muted">{ui.common.empty}</p>}
        </aside>
      </div>
    </div>
  );
}
