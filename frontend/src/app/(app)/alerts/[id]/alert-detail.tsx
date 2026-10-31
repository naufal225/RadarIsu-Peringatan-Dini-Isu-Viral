"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, FileText, Info, ShieldAlert } from "lucide-react";
import { useCan } from "@/components/permissions-provider";
import { Section } from "@/components/radar/section";
import { Button } from "@/components/radar/button";
import { SeverityBadge } from "@/components/radar/severity-badge";
import { StatusChip } from "@/components/radar/status-chip";
import { SimBadge } from "@/components/radar/simulation";
import { Waktu } from "@/components/radar/waktu";
import { Field, controlClass } from "@/components/radar/form";
import { ErrorState } from "@/components/radar/states";
import { SkeletonRows } from "@/components/radar/skeleton";
import { api, ApiError } from "@/lib/api";
import { summarizeEvidence } from "@/lib/coordination";
import {
  alertActionLabels,
  alertKindLabels,
  evidenceReasonLabels,
  ui,
} from "@/lib/labels";
import { useApiData } from "@/lib/use-api-data";
import type { AlertStatus, Severity } from "@/components/radar/types";

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
  status: AlertStatus;
  score: number;
  severity: Severity;
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
    return <ErrorState title={ui.common.loadError} description="Gagal memuat rincian peringatan." onRetry={reload} />;
  }

  if (data === null) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-control bg-line" />
        <SkeletonRows columns={4} />
      </div>
    );
  }

  const alert = data.data;
  const isSimulated = alert.evidence?.some((ev) => ev.post?.is_simulated);

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

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          href="/alerts"
          className="inline-flex items-center gap-1.5 text-table font-medium text-brand hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>{ui.alerts.backToList}</span>
        </Link>
      </div>

      {/* Main Incident Header */}
      <div className="rounded-control border border-line bg-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-table text-ink-muted">#{alert.id}</span>
              <SeverityBadge severity={alert.severity} size="md" />
              <StatusChip status={alert.status} />
              {isSimulated && <SimBadge />}
            </div>
            <h1 className="mt-2 font-serif text-title font-semibold text-ink">
              {alert.topic?.name ?? (alert.subject_account?.handle ? `@${alert.subject_account.handle}` : ui.common.none)}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
              <span>{alertKindLabels[alert.kind] ?? alert.kind}</span>
              <span>·</span>
              <span>Terdeteksi: <Waktu value={alert.detected_at} /></span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-control border border-line bg-paper px-4 py-2 text-right">
              <span className="block text-caption text-ink-muted">{ui.alerts.score}</span>
              <span className="font-mono text-metric font-semibold tabular-nums text-ink">{alert.score}</span>
            </div>

            {alert.status !== "new" && can("briefings.create") && (
              <Button
                variant="primary"
                pending={busyAction === "briefings"}
                onClick={handleCreateBriefing}
              >
                <FileText className="size-4" aria-hidden="true" />
                <span>{busyAction === "briefings" ? ui.alerts.generatingBriefing : ui.alerts.generateBriefing}</span>
              </Button>
            )}
          </div>
        </div>

        {formError && (
          <div className="mt-4 rounded-control border border-sev-high/30 bg-sev-high-bg p-3 text-sm text-sev-high">
            {formError}
          </div>
        )}

        {briefingMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-control border border-brand/30 bg-brand-tint/40 p-3 text-sm text-brand font-medium">
            <CheckCircle className="size-4 shrink-0" aria-hidden="true" />
            <span>{briefingMsg}</span>
          </div>
        )}
      </div>

      {/* Rekomendasi Terakhir */}
      {alert.recommendation && (
        <div className="rounded-control border border-brand/20 bg-brand-tint/30 p-4">
          <div className="flex items-center gap-2 text-table font-semibold text-brand">
            <Info className="size-4 shrink-0" aria-hidden="true" />
            <span>{ui.alerts.recommendation}</span>
          </div>
          <p className="mt-1 text-sm text-ink">{alert.recommendation}</p>
        </div>
      )}

      {/* Rincian Skor Ancaman */}
      {alert.score_breakdown && (
        <Section flush title={ui.alerts.scoreBreakdown} description="Komposisi bobot indikator penilaian ancaman.">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-table">
              <thead className="border-b border-line bg-paper text-ink-muted">
                <tr>
                  <th scope="col" className="h-9 px-4 font-medium">{ui.alerts.reason}</th>
                  <th scope="col" className="h-9 px-4 text-right font-medium">{ui.alerts.raw}</th>
                  <th scope="col" className="h-9 px-4 text-right font-medium">{ui.alerts.weight}</th>
                  <th scope="col" className="h-9 px-4 text-right font-medium">{ui.alerts.value}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {alert.score_breakdown.spike && (
                  <tr className="h-9 hover:bg-hover">
                    <td className="px-4 font-medium text-ink">{ui.alerts.spike}</td>
                    <td className="px-4 text-right font-mono text-ink-muted">{alert.score_breakdown.spike.raw}</td>
                    <td className="px-4 text-right font-mono text-ink-muted">{alert.score_breakdown.spike.weight}%</td>
                    <td className="px-4 text-right font-mono font-semibold text-ink">{alert.score_breakdown.spike.value}</td>
                  </tr>
                )}
                {alert.score_breakdown.anomaly && (
                  <tr className="h-9 hover:bg-hover">
                    <td className="px-4 font-medium text-ink">{ui.alerts.anomaly}</td>
                    <td className="px-4 text-right font-mono text-ink-muted">{alert.score_breakdown.anomaly.raw}</td>
                    <td className="px-4 text-right font-mono text-ink-muted">{alert.score_breakdown.anomaly.weight}%</td>
                    <td className="px-4 text-right font-mono font-semibold text-ink">{alert.score_breakdown.anomaly.value}</td>
                  </tr>
                )}
                {alert.score_breakdown.sentiment && (
                  <tr className="h-9 hover:bg-hover">
                    <td className="px-4 font-medium text-ink">{ui.alerts.sentiment}</td>
                    <td className="px-4 text-right font-mono text-ink-muted">{alert.score_breakdown.sentiment.raw}</td>
                    <td className="px-4 text-right font-mono text-ink-muted">{alert.score_breakdown.sentiment.weight}%</td>
                    <td className="px-4 text-right font-mono font-semibold text-ink">{alert.score_breakdown.sentiment.value}</td>
                  </tr>
                )}
                {alert.score_breakdown.reach && (
                  <tr className="h-9 hover:bg-hover">
                    <td className="px-4 font-medium text-ink">{ui.alerts.reach}</td>
                    <td className="px-4 text-right font-mono text-ink-muted">{alert.score_breakdown.reach.raw}</td>
                    <td className="px-4 text-right font-mono text-ink-muted">{alert.score_breakdown.reach.weight}%</td>
                    <td className="px-4 text-right font-mono font-semibold text-ink">{alert.score_breakdown.reach.value}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {alert.score_breakdown.thresholds && (
            <div className="border-t border-line bg-paper px-4 py-2 font-mono text-caption text-ink-muted">
              {ui.alerts.thresholds}: {JSON.stringify(alert.score_breakdown.thresholds)}
            </div>
          )}
        </Section>
      )}

      {/* Bukti Terlampir */}
      <Section flush title={ui.alerts.evidence} description="Indikator dan bukti postingan anomali yang ditemukan.">
        {!alert.evidence || alert.evidence.length === 0 ? (
          <div className="p-5 text-sm text-ink-muted">{ui.alerts.noEvidence}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-table">
              <thead className="border-b border-line bg-paper text-ink-muted">
                <tr>
                  <th scope="col" className="h-9 px-4 font-medium">{ui.alerts.reason}</th>
                  <th scope="col" className="h-9 px-4 font-medium">{ui.alerts.account}</th>
                  <th scope="col" className="h-9 px-4 font-medium">{ui.alerts.postSnippet}</th>
                  <th scope="col" className="h-9 px-4 font-medium">{ui.alerts.detail}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {alert.evidence.map((ev) => (
                  <tr key={ev.id} className="hover:bg-hover">
                    <td className="px-4 py-3 align-top font-medium text-ink whitespace-nowrap">
                      {evidenceReasonLabels[ev.reason] ?? ev.reason}
                    </td>
                    <td className="px-4 py-3 align-top font-mono text-caption text-ink-muted whitespace-nowrap">
                      {ev.account?.handle ? `@${ev.account.handle}` : ui.common.none}
                    </td>
                    <td className="max-w-md px-4 py-3 align-top text-sm text-ink">
                      <span>{ev.post?.text ?? ui.common.none}</span>
                      {ev.post?.is_simulated && (
                        <span className="ml-2 inline-block"><SimBadge /></span>
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-3 align-top text-caption text-ink-muted">
                      {summarizeEvidence(ev.reason, ev.detail) && (
                        <p className="mb-1 text-ink">{summarizeEvidence(ev.reason, ev.detail)}</p>
                      )}
                      {ev.detail ? (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-brand hover:underline">{ui.coordination.evidence.raw}</summary>
                          <pre className="mt-1 overflow-x-auto rounded-control bg-paper p-2 font-mono text-[11px] text-ink">
                            {JSON.stringify(ev.detail, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        ui.common.none
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Riwayat Penanganan (Timeline) */}
      <Section title={ui.alerts.timeline} description="Rekam jejak tindakan investigasi dan keputusan komando.">
        {!alert.actions || alert.actions.length === 0 ? (
          <p className="text-sm text-ink-muted">{ui.common.empty}</p>
        ) : (
          <div className="space-y-3">
            {alert.actions.map((act, idx) => (
              <div key={idx} className="rounded-control border border-line bg-paper p-3.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink">
                    {alertActionLabels[act.action] ?? act.action} ·{" "}
                    <span className="font-normal text-ink-muted">{act.user ?? ui.audit.system}</span>
                  </span>
                  <Waktu value={act.created_at} />
                </div>
                {act.note && <p className="mt-2 text-ink">{act.note}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Operasi Triase Sesuai Peran */}
      <Section title={ui.alerts.action} description="Aksi penanganan insiden berdasarkan kewenangan peran.">
        <div className="space-y-5 rounded-control border border-line bg-panel p-5">
          {/* Analyst Operations */}
          {can("alerts.triage") && (
            <>
              {alert.status === "new" && (
                <div>
                  <Button
                    variant="primary"
                    pending={busyAction === "take"}
                    onClick={() => handleAction("take")}
                  >
                    <ShieldAlert className="size-4" aria-hidden="true" />
                    <span>{busyAction === "take" ? ui.alerts.taking : ui.alerts.take}</span>
                  </Button>
                </div>
              )}

              {(alert.status === "reviewing" || alert.status === "returned") && (
                <div className="space-y-4">
                  {/* Form Eskalasi */}
                  <form onSubmit={submitEscalate} className="space-y-3 border-b border-line pb-4">
                    <Field label={ui.alerts.recommendation}>
                      <textarea
                        name="recommendation"
                        rows={2}
                        required
                        placeholder={ui.alerts.recommendationPlaceholder}
                        className={controlClass}
                      />
                    </Field>
                    <Field label={ui.alerts.note}>
                      <input
                        name="note"
                        type="text"
                        placeholder={ui.alerts.notePlaceholder}
                        className={controlClass}
                      />
                    </Field>
                    <Button type="submit" variant="primary" pending={busyAction === "escalate"}>
                      {busyAction === "escalate" ? ui.alerts.escalating : ui.alerts.escalate}
                    </Button>
                  </form>

                  {/* Form Positif Palsu */}
                  <form
                    onSubmit={(e) => submitNoteAction(e, "false-positive")}
                    className="flex flex-wrap items-end gap-3 border-b border-line pb-4"
                  >
                    <div className="flex-1 min-w-[200px]">
                      <Field label={ui.alerts.falsePositive}>
                        <input
                          name="note"
                          type="text"
                          required
                          placeholder={ui.alerts.notePlaceholder}
                          className={controlClass}
                        />
                      </Field>
                    </div>
                    <Button type="submit" variant="secondary" pending={busyAction === "false-positive"}>
                      {busyAction === "false-positive" ? ui.alerts.closingFp : ui.alerts.falsePositive}
                    </Button>
                  </form>

                  {/* Form Tutup Isu */}
                  <form
                    onSubmit={(e) => submitNoteAction(e, "close")}
                    className="flex flex-wrap items-end gap-3 border-b border-line pb-4"
                  >
                    <div className="flex-1 min-w-[200px]">
                      <Field label={ui.alerts.close}>
                        <input
                          name="note"
                          type="text"
                          required
                          placeholder={ui.alerts.notePlaceholder}
                          className={controlClass}
                        />
                      </Field>
                    </div>
                    <Button type="submit" variant="secondary" pending={busyAction === "close"}>
                      {busyAction === "close" ? ui.alerts.closing : ui.alerts.close}
                    </Button>
                  </form>
                </div>
              )}
            </>
          )}

          {/* Leader Operations */}
          {can("alerts.decide") && alert.status === "escalated" && (
            <div className="space-y-4">
              {/* Form Approve */}
              <form
                onSubmit={(e) => submitNoteAction(e, "approve")}
                className="flex flex-wrap items-end gap-3 border-b border-line pb-4"
              >
                <div className="flex-1 min-w-[200px]">
                  <Field label={ui.alerts.approve}>
                    <input
                      name="note"
                      type="text"
                      placeholder={ui.alerts.notePlaceholder}
                      className={controlClass}
                    />
                  </Field>
                </div>
                <Button type="submit" variant="primary" pending={busyAction === "approve"}>
                  {busyAction === "approve" ? ui.alerts.approving : ui.alerts.approve}
                </Button>
              </form>

              {/* Form Return */}
              <form
                onSubmit={(e) => submitNoteAction(e, "return")}
                className="space-y-3 border-b border-line pb-4"
              >
                <Field label={ui.alerts.return}>
                  <textarea
                    name="note"
                    rows={2}
                    required
                    placeholder={ui.alerts.notePlaceholder}
                    className={controlClass}
                  />
                </Field>
                <Button type="submit" variant="secondary" pending={busyAction === "return"}>
                  {busyAction === "return" ? ui.alerts.returning : ui.alerts.return}
                </Button>
              </form>
            </div>
          )}

          {/* Comment Form */}
          <form onSubmit={submitComment} className="space-y-3">
            <Field label={ui.alerts.addComment}>
              <textarea
                name="note"
                rows={2}
                required
                placeholder={ui.alerts.commentPlaceholder}
                className={controlClass}
              />
            </Field>
            <Button type="submit" variant="secondary" pending={busyAction === "comments"}>
              {busyAction === "comments" ? ui.alerts.commenting : ui.alerts.comment}
            </Button>
          </form>
        </div>
      </Section>
    </div>
  );
}
