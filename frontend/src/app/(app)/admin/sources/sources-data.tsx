"use client";

import { useState } from "react";
import { useCan } from "@/components/permissions-provider";
import { SourcesView, type ImportState, type SourceFormState, type SourcesViewProps } from "@/components/sources/sources-view";
import { api, ApiError } from "@/lib/api";
import type { ImportBatch, Source, SourceList } from "@/lib/api-types/sources";
import { describeErrorCode, ui } from "@/lib/labels";
import { emptySourceForm, fieldErrors, formFromSource, sourcePayload } from "@/lib/sources";
import { useApiData } from "@/lib/use-api-data";

const CLOSED_FORM: SourceFormState = { open: false, mode: "create", sourceId: null, values: emptySourceForm(), errors: {}, pending: false, failed: false };
const CLOSED_IMPORT: ImportState = { source: null, pending: false, result: null, fileErrors: [], failed: false, history: null };

function codes(e: unknown): string {
  const list = e instanceof ApiError ? Object.values(e.body?.errors ?? {}).flat() : [];
  return list.length ? list.map(describeErrorCode).join("; ") : ui.common.actionError;
}

/** Pengambil data /admin/sources. */
export function SourcesData() {
  const can = useCan();
  const { data, error, loading, reload } = useApiData<SourceList>("sources");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rowNotice, setRowNotice] = useState<SourcesViewProps["rowNotice"]>(null);
  const [form, setForm] = useState<SourceFormState>(CLOSED_FORM);
  const [imports, setImports] = useState<ImportState>(CLOSED_IMPORT);

  async function test(source: Source) {
    setBusyId(source.id);
    setRowNotice(null);
    try {
      // Hasil uji selalu 200: ditampilkan sebagai data (status dan galat terakhir), bukan sebagai galat.
      const updated = await api<{ data: Source }>(`sources/${source.id}/test`, { method: "POST" });
      const ok = updated.data.last_status === "ok";
      setRowNotice({ id: source.id, tone: ok ? "ok" : "error", text: ok ? ui.sources.testOk(source.name) : ui.sources.testFailed(source.name) });
      reload();
    } catch (e) {
      setRowNotice({ id: source.id, tone: "error", text: codes(e) });
    } finally {
      setBusyId(null);
    }
  }

  async function toggle(source: Source) {
    setBusyId(source.id);
    setRowNotice(null);
    try {
      await api(`sources/${source.id}`, { method: "PATCH", body: JSON.stringify({ is_active: !source.is_active }) });
      reload();
    } catch (e) {
      setRowNotice({ id: source.id, tone: "error", text: codes(e) });
    } finally {
      setBusyId(null);
    }
  }

  async function submitForm() {
    setForm((f) => ({ ...f, pending: true, errors: {}, failed: false }));
    try {
      if (form.mode === "create") await api("sources", { method: "POST", body: JSON.stringify(sourcePayload(form.values, "create")) });
      else await api(`sources/${form.sourceId}`, { method: "PATCH", body: JSON.stringify(sourcePayload(form.values, "edit")) });
      setForm(CLOSED_FORM);
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setForm((f) => ({ ...f, pending: false, errors: fieldErrors(e.body) }));
      else setForm((f) => ({ ...f, pending: false, failed: true }));
    }
  }

  async function openImport(source: Source) {
    setImports({ ...CLOSED_IMPORT, source });
    const history = await api<{ data: ImportBatch[] }>(`sources/${source.id}/imports`).catch(() => null);
    setImports((s) => (s.source?.id === source.id ? { ...s, history: history?.data ?? [] } : s));
  }

  async function submitImport(file: FormData) {
    const source = imports.source;
    if (!source) return;
    setImports((s) => ({ ...s, pending: true, result: null, fileErrors: [], failed: false }));
    try {
      const batch = await api<{ data: ImportBatch }>(`sources/${source.id}/import`, { method: "POST", body: file });
      setImports((s) => ({ ...s, pending: false, result: batch.data, history: [batch.data, ...(s.history ?? [])] }));
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setImports((s) => ({ ...s, pending: false, fileErrors: Object.values(e.body?.errors ?? {}).flat() }));
      else setImports((s) => ({ ...s, pending: false, failed: true }));
    }
  }

  return (
    <SourcesView
      result={data}
      loading={loading}
      failed={error && data === null}
      onRetry={reload}
      canManage={can("sources.manage")}
      busyId={busyId}
      rowNotice={rowNotice}
      onTest={test}
      onToggle={toggle}
      onEdit={(source) => setForm({ ...CLOSED_FORM, open: true, mode: "edit", sourceId: source.id, values: formFromSource(source) })}
      onNew={() => setForm({ ...CLOSED_FORM, open: true })}
      onImport={openImport}
      form={form}
      onFormChange={(values) => setForm((f) => ({ ...f, values }))}
      onFormSubmit={submitForm}
      onFormClose={() => setForm(CLOSED_FORM)}
      imports={imports}
      onImportSubmit={submitImport}
      onImportClose={() => setImports(CLOSED_IMPORT)}
    />
  );
}
