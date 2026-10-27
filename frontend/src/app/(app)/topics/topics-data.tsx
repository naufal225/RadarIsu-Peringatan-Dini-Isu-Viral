"use client";

import { useState } from "react";
import { useCan } from "@/components/permissions-provider";
import { TopicsView, type OfficialsState, type TopicFormState, type TopicFormValues } from "@/components/topics/topics-view";
import { api, ApiError } from "@/lib/api";
import type { OfficialAccount, Topic, TopicList } from "@/lib/api-types/topics";
import { ui } from "@/lib/labels";
import { parseKeywords } from "@/lib/topics";
import { useApiData } from "@/lib/use-api-data";

const EMPTY_VALUES: TopicFormValues = { name: "", category: "general", sensitivity: "medium", keywordsText: "", is_active: true };
const CLOSED: TopicFormState = { open: false, topicId: null, values: EMPTY_VALUES, errors: {}, pending: false, failed: false };

const valuesOf = (topic: Topic, active = topic.is_active): TopicFormValues => ({
  name: topic.name,
  category: topic.category,
  sensitivity: topic.sensitivity,
  keywordsText: topic.keywords.join("\n"),
  is_active: active,
});

/** Pengambil data /topics. */
export function TopicsData() {
  const can = useCan();
  const { data, error, loading, reload } = useApiData<TopicList>("topics");
  const officialsData = useApiData<{ data: OfficialAccount[] }>("official-accounts");
  const [form, setForm] = useState<TopicFormState>(CLOSED);
  const [rowError, setRowError] = useState<{ id: number; text: string } | null>(null);
  const [addErrors, setAddErrors] = useState<Record<string, string[]>>({});
  const [addPending, setAddPending] = useState(false);
  const [confirming, setConfirming] = useState<OfficialAccount | null>(null);
  const [removing, setRemoving] = useState(false);

  async function submit() {
    const body = JSON.stringify({
      name: form.values.name.trim(),
      category: form.values.category,
      sensitivity: form.values.sensitivity,
      keywords: parseKeywords(form.values.keywordsText),
      is_active: form.values.is_active,
    });
    setForm((f) => ({ ...f, pending: true, errors: {}, failed: false }));
    try {
      await api(form.topicId === null ? "topics" : `topics/${form.topicId}`, { method: form.topicId === null ? "POST" : "PATCH", body });
      setForm(CLOSED);
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setForm((f) => ({ ...f, pending: false, errors: e.body?.errors ?? {} }));
      else setForm((f) => ({ ...f, pending: false, failed: true }));
    }
  }

  async function toggle(topic: Topic) {
    setRowError(null);
    try {
      await api(`topics/${topic.id}`, { method: "PATCH", body: JSON.stringify({ is_active: !topic.is_active }) });
      reload();
    } catch {
      setRowError({ id: topic.id, text: ui.common.actionError });
    }
  }

  async function addOfficial(formData: FormData) {
    setAddPending(true);
    setAddErrors({});
    try {
      await api("official-accounts", {
        method: "POST",
        body: JSON.stringify({ handle: formData.get("handle"), display_name: formData.get("display_name"), note: formData.get("note") || null }),
      });
      officialsData.reload();
    } catch (e) {
      setAddErrors(e instanceof ApiError && e.status === 422 ? (e.body?.errors ?? {}) : { form: ["failed"] });
    } finally {
      setAddPending(false);
    }
  }

  async function removeOfficial() {
    if (!confirming) return;
    setRemoving(true);
    try {
      await api(`official-accounts/${confirming.id}`, { method: "DELETE" });
      officialsData.reload();
    } finally {
      setRemoving(false);
      setConfirming(null);
    }
  }

  const officials: OfficialsState = {
    result: officialsData.data,
    failed: officialsData.error && officialsData.data === null,
    addErrors,
    addPending,
    confirming,
    removing,
  };

  return (
    <TopicsView
      result={data}
      loading={loading}
      failed={error && data === null}
      onRetry={reload}
      canManage={can("topics.manage")}
      // Dari templat: isian [dalam kurung] ikut tersalin; server menolaknya sampai diganti (PRD §9.8).
      onCreate={(template) => setForm({ ...CLOSED, open: true, values: template ? valuesOf(template, true) : EMPTY_VALUES })}
      onEdit={(topic) => setForm({ ...CLOSED, open: true, topicId: topic.id, values: valuesOf(topic) })}
      onToggle={toggle}
      rowError={rowError}
      form={form}
      onFormChange={(values) => setForm((f) => ({ ...f, values }))}
      onFormSubmit={submit}
      onFormClose={() => setForm(CLOSED)}
      officials={officials}
      onAddOfficial={addOfficial}
      onAskRemoveOfficial={setConfirming}
      onCancelRemoveOfficial={() => setConfirming(null)}
      onConfirmRemoveOfficial={removeOfficial}
    />
  );
}
