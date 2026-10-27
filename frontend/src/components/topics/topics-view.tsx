"use client";

import { TriangleAlert } from "lucide-react";
import type { FormEvent } from "react";
import { Button } from "@/components/radar/button";
import { ConfirmDialog } from "@/components/radar/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/radar/data-table";
import { Dialog } from "@/components/radar/dialog";
import { controlClass, Field, FieldError } from "@/components/radar/form";
import { PageHeader } from "@/components/radar/page-header";
import { Section } from "@/components/radar/section";
import { EmptyState } from "@/components/radar/states";
import type { OfficialAccount, Topic, TopicCategory, TopicList, TopicSensitivity } from "@/lib/api-types/topics";
import { cn } from "@/lib/cn";
import { sensitivityLabels, topicCategoryLabels, ui } from "@/lib/labels";
import { CATEGORIES, hasPlaceholder, parseKeywords, SENSITIVITIES } from "@/lib/topics";

const copy = ui.topics;

export type TopicFormValues = { name: string; category: TopicCategory; sensitivity: TopicSensitivity; keywordsText: string; is_active: boolean };

export type TopicFormState = {
  open: boolean;
  /** Topic being edited; null when creating (from scratch or from a template). */
  topicId: number | null;
  values: TopicFormValues;
  /** 422 error codes per field (keywords: keyword_has_placeholder, keywords_unmatchable; ...). */
  errors: Record<string, string[]>;
  pending: boolean;
  failed: boolean;
};

export type OfficialsState = {
  result: { data: OfficialAccount[] } | null;
  failed: boolean;
  addErrors: Record<string, string[]>;
  addPending: boolean;
  /** Account waiting for delete confirmation. */
  confirming: OfficialAccount | null;
  removing: boolean;
};

export type TopicsViewProps = {
  result: TopicList | null;
  loading: boolean;
  failed: boolean;
  onRetry?: () => void;
  canManage: boolean;
  onCreate: (template: Topic | null) => void;
  onEdit: (topic: Topic) => void;
  onToggle: (topic: Topic) => void;
  rowError: { id: number; text: string } | null;
  form: TopicFormState;
  onFormChange: (values: TopicFormValues) => void;
  onFormSubmit: () => void;
  onFormClose: () => void;
  officials: OfficialsState;
  onAddOfficial: (form: FormData) => void;
  onAskRemoveOfficial: (account: OfficialAccount) => void;
  onCancelRemoveOfficial: () => void;
  onConfirmRemoveOfficial: () => void;
};

/** Kata kunci dengan penanda visual untuk isian templat yang belum diganti. */
function Keywords({ keywords }: { keywords: string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {keywords.map((keyword) => {
        const placeholder = hasPlaceholder(keyword);
        return (
          <span
            key={keyword}
            title={placeholder ? copy.list.placeholderMarker : undefined}
            className={cn(
              "inline-flex items-center gap-1 rounded-badge border px-1.5 py-0.5 font-mono text-caption",
              placeholder ? "border-dashed border-sev-medium bg-sev-medium-bg text-sev-medium" : "border-line bg-paper text-ink",
            )}
          >
            {placeholder && <TriangleAlert aria-hidden="true" className="size-3" />}
            {keyword}
          </span>
        );
      })}
    </span>
  );
}

/** Presentasi murni /topics: daftar topik, templat, dialog buat/ubah, dan akun resmi. */
export function TopicsView(props: TopicsViewProps) {
  const { result, loading, failed, onRetry, canManage, rowError } = props;
  const topics = result?.data.filter((t) => !t.is_template) ?? [];
  const templates = result?.data.filter((t) => t.is_template) ?? [];

  const columns: DataTableColumn<Topic>[] = [
    {
      id: "name",
      header: copy.columns.name,
      cell: (t) => (
        <span className="block py-1">
          {t.name}
          {rowError?.id === t.id && <span className="block text-caption font-normal text-sev-high">{rowError.text}</span>}
        </span>
      ),
    },
    { id: "category", header: copy.columns.category, cell: (t) => topicCategoryLabels[t.category] },
    { id: "sensitivity", header: copy.columns.sensitivity, cell: (t) => sensitivityLabels[t.sensitivity] },
    { id: "keywords", header: copy.columns.keywords, cell: (t) => <span title={t.keywords.join(", ")}>{copy.list.keywordCount(t.keywords.length)}</span> },
    { id: "active", header: copy.list.active, cell: (t) => (t.is_active ? copy.list.yes : copy.list.no) },
  ];
  if (canManage) {
    columns.push({
      id: "actions",
      header: copy.list.actions,
      cell: (t) => (
        <span className="flex flex-wrap gap-2 py-1">
          <Button onClick={() => props.onEdit(t)}>{copy.edit}</Button>
          <Button onClick={() => props.onToggle(t)}>{t.is_active ? ui.common.deactivate : ui.common.activate}</Button>
        </span>
      ),
    });
  }

  const templateColumns: DataTableColumn<Topic>[] = [
    { id: "name", header: copy.columns.name, cell: (t) => t.name },
    { id: "category", header: copy.columns.category, cell: (t) => topicCategoryLabels[t.category] },
    { id: "keywords", header: copy.columns.keywords, cell: (t) => <Keywords keywords={t.keywords} /> },
  ];
  if (canManage) templateColumns.push({ id: "use", header: copy.list.actions, cell: (t) => <Button onClick={() => props.onCreate(t)}>{copy.useTemplate}</Button> });

  return (
    <>
      <PageHeader
        title={copy.title}
        subtitle={copy.list.subtitle}
        actions={canManage ? <Button variant="primary" onClick={() => props.onCreate(null)}>{copy.list.create}</Button> : undefined}
      />

      <div className="mb-6">
        <DataTable
          columns={columns}
          rows={topics}
          getRowKey={(t) => t.id}
          rowHref={(t) => `/topics/${t.id}`}
          loading={loading && result === null}
          error={failed ? { onRetry } : null}
          caption={copy.list.tableCaption}
          empty={<EmptyState title={copy.noTopics} />}
        />
      </div>

      {templates.length > 0 && (
        <Section title={copy.templatesTitle} description={copy.templatesIntro}>
          <DataTable columns={templateColumns} rows={templates} getRowKey={(t) => t.id} caption={copy.list.templatesCaption} />
        </Section>
      )}

      <OfficialAccountsSection {...props} />
      {canManage && <TopicFormDialog {...props} />}
    </>
  );
}

function TopicFormDialog({ form, onFormChange, onFormSubmit, onFormClose }: TopicsViewProps) {
  const { values, errors } = form;
  const set = (patch: Partial<TopicFormValues>) => onFormChange({ ...values, ...patch });
  const keywords = parseKeywords(values.keywordsText);
  const placeholder = hasPlaceholder(values.keywordsText);
  const editing = form.topicId !== null;
  // PRD §9.8: [ dan ] ditolak server (422); pesannya selalu di bawah bidang kata kunci.
  const keywordMessages = [...(errors.keywords ?? []), ...Object.entries(errors).filter(([k]) => k.startsWith("keywords.")).flatMap(([, v]) => v)];
  const keywordError = keywordMessages.length
    ? [...new Set(keywordMessages)].map((code) => copy.errors[code] ?? ui.common.actionError).join(" ")
    : placeholder
      ? copy.placeholderWarning
      : null;
  const otherError = (field: string) => (errors[field]?.length ? errors[field].map((code) => copy.errors[code] ?? ui.common.actionError).join(" ") : null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onFormSubmit();
  }

  return (
    <Dialog open={form.open} title={editing ? copy.form.editTitle(values.name) : copy.form.createTitle} onClose={onFormClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={copy.form.name} error={otherError("name")}>
          <input name="name" required maxLength={150} value={values.name} onChange={(e) => set({ name: e.target.value })} className={controlClass} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={copy.form.category} error={otherError("category")}>
            <select name="category" value={values.category} onChange={(e) => set({ category: e.target.value as TopicCategory })} className={controlClass}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {topicCategoryLabels[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={copy.form.sensitivity} hint={copy.form.sensitivityHint} error={otherError("sensitivity")}>
            <select name="sensitivity" value={values.sensitivity} onChange={(e) => set({ sensitivity: e.target.value as TopicSensitivity })} className={controlClass}>
              {SENSITIVITIES.map((s) => (
                <option key={s} value={s}>
                  {sensitivityLabels[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={copy.form.keywords} hint={copy.form.keywordsHint} error={keywordError}>
          <textarea
            name="keywords"
            required
            rows={5}
            value={values.keywordsText}
            aria-invalid={!!keywordError}
            onChange={(e) => set({ keywordsText: e.target.value })}
            className={cn(controlClass, "h-auto py-2 font-mono", keywordError && "border-sev-high")}
          />
        </Field>
        {keywords.length > 0 && <Keywords keywords={keywords} />}
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="is_active" checked={values.is_active} onChange={(e) => set({ is_active: e.target.checked })} />
          {copy.form.active}
        </label>
        {otherError("topic") && <FieldError>{otherError("topic")}</FieldError>}
        {form.failed && <FieldError>{ui.common.actionError}</FieldError>}
        <div className="flex justify-end gap-2">
          <Button onClick={onFormClose} disabled={form.pending}>
            {copy.list.close}
          </Button>
          {/* Tombol tetap aktif walau ada [ ]: server yang menolak (422) dan pesannya tampil di bawah bidang. */}
          <Button type="submit" variant="primary" pending={form.pending} disabled={keywords.length === 0 || values.name.trim() === ""}>
            {form.pending ? ui.common.saving : editing ? copy.form.save : copy.form.create}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function OfficialAccountsSection({ officials, canManage, onAddOfficial, onAskRemoveOfficial, onCancelRemoveOfficial, onConfirmRemoveOfficial }: TopicsViewProps) {
  const oc = copy.officialAccounts;
  const columns: DataTableColumn<OfficialAccount>[] = [
    { id: "handle", header: oc.handle, cell: (a) => a.handle, mono: true },
    { id: "name", header: oc.displayName, cell: (a) => a.display_name },
    { id: "note", header: oc.note, cell: (a) => a.note ?? ui.common.none },
  ];
  if (canManage) columns.push({ id: "remove", header: copy.list.actions, cell: (a) => <Button onClick={() => onAskRemoveOfficial(a)}>{oc.remove}</Button> });

  const err = (field: string) => {
    const messages = officials.addErrors[field];
    if (!messages?.length) return null;
    // Laravel menjawab "has already been taken" untuk handle ganda.
    return field === "handle" && messages.some((m) => /taken/i.test(m)) ? oc.duplicate : ui.common.actionError;
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAddOfficial(new FormData(event.currentTarget));
  }

  return (
    <Section title={oc.title} description={oc.intro}>
      <DataTable
        columns={columns}
        rows={officials.result?.data ?? []}
        getRowKey={(a) => a.id}
        loading={officials.result === null && !officials.failed}
        error={officials.failed ? {} : null}
        caption={oc.tableCaption}
        empty={<EmptyState title={oc.empty} />}
      />
      {canManage && (
        <>
          <form onSubmit={submit} className="mt-4 grid max-w-3xl gap-3 sm:grid-cols-3">
            <Field label={oc.handle} error={err("handle")}>
              <input name="handle" required maxLength={190} className={controlClass} />
            </Field>
            <Field label={oc.displayName} error={err("display_name")}>
              <input name="display_name" required maxLength={190} className={controlClass} />
            </Field>
            <Field label={oc.note} error={err("note")}>
              <input name="note" maxLength={255} className={controlClass} />
            </Field>
            <div className="sm:col-span-3">
              <Button type="submit" variant="primary" pending={officials.addPending}>
                {officials.addPending ? ui.common.saving : oc.add}
              </Button>
            </div>
          </form>
          <ConfirmDialog
            open={officials.confirming !== null}
            title={oc.confirmRemoveTitle(officials.confirming?.handle ?? "")}
            description={oc.confirmRemoveBody}
            confirmLabel={oc.remove}
            destructive
            pending={officials.removing}
            onConfirm={onConfirmRemoveOfficial}
            onClose={onCancelRemoveOfficial}
          />
        </>
      )}
    </Section>
  );
}
