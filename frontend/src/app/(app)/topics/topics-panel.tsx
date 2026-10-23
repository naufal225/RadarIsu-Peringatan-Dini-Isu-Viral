"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Can } from "@/components/permissions-provider";
import { Button, ErrorText, Field, FieldErrors, inputClass, PageTitle, Section, StatusBadge, Table, Td } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { invalidFields } from "@/lib/format";
import { sensitivityLabels, topicCategoryLabels, ui } from "@/lib/labels";
import {
  CATEGORIES,
  errorCodes,
  hasPlaceholder,
  parseKeywords,
  SENSITIVITIES,
  type Topic,
  type TopicCategory,
  type TopicSensitivity,
} from "@/lib/topics";
import { useApiData } from "@/lib/use-api-data";
import { OfficialAccountsPanel } from "./official-accounts-panel";

const copy = ui.topics;

type FormValues = {
  name: string;
  category: TopicCategory;
  sensitivity: TopicSensitivity;
  keywordsText: string;
  is_active: boolean;
};

/** What the form shows; a new `key` remounts it with fresh values. */
type Seed = { key: number; topic: Topic | null; values: FormValues };

const EMPTY: FormValues = { name: "", category: "general", sensitivity: "medium", keywordsText: "", is_active: true };

const valuesOf = (topic: Topic): FormValues => ({
  name: topic.name,
  category: topic.category,
  sensitivity: topic.sensitivity,
  keywordsText: topic.keywords.join("\n"),
  is_active: topic.is_active,
});

export function TopicsPanel() {
  const { data, error: loadError, reload } = useApiData<{ data: Topic[] }>("topics");
  const [seed, setSeed] = useState<Seed>({ key: 0, topic: null, values: EMPTY });
  const [error, setError] = useState<string | null>(null);

  const topics = data?.data.filter((topic) => !topic.is_template) ?? null;
  const templates = data?.data.filter((topic) => topic.is_template) ?? [];

  function open(topic: Topic | null, values: FormValues) {
    setSeed((current) => ({ key: current.key + 1, topic, values }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleActive(topic: Topic) {
    setError(null);
    try {
      await api(`topics/${topic.id}`, { method: "PATCH", body: JSON.stringify({ is_active: !topic.is_active }) });
      reload();
    } catch {
      setError(ui.common.actionError);
    }
  }

  return (
    <>
      <PageTitle>{copy.title}</PageTitle>
      <p className="mb-4 max-w-3xl text-sm text-neutral-600">{copy.intro}</p>
      <ErrorText>{loadError ? ui.common.loadError : error}</ErrorText>

      <Can permission="topics.manage">
        <Section title={seed.topic ? copy.form.editTitle(seed.topic.name) : copy.form.createTitle}>
          <TopicForm
            key={seed.key}
            seed={seed}
            onDone={() => {
              setSeed((current) => ({ key: current.key + 1, topic: null, values: EMPTY }));
              reload();
            }}
            onCancel={() => setSeed((current) => ({ key: current.key + 1, topic: null, values: EMPTY }))}
          />
        </Section>
      </Can>

      <Section title={copy.title}>
        {topics === null ? (
          <p className="text-sm text-neutral-500">{ui.loading}</p>
        ) : topics.length === 0 ? (
          <p className="text-sm text-neutral-500">{copy.noTopics}</p>
        ) : (
          <Table head={[copy.columns.name, copy.columns.category, copy.columns.keywords, copy.columns.sensitivity, copy.columns.status, ""]}>
            {topics.map((topic) => (
              <tr key={topic.id}>
                <Td>
                  <Link href={`/topics/${topic.id}`} className="font-medium underline">
                    {topic.name}
                  </Link>
                </Td>
                <Td>{topicCategoryLabels[topic.category]}</Td>
                <Td>{topic.keywords.join(", ")}</Td>
                <Td>{sensitivityLabels[topic.sensitivity]}</Td>
                <Td>
                  <StatusBadge tone={topic.is_active ? "ok" : "muted"}>
                    {topic.is_active ? ui.common.active : ui.common.inactive}
                  </StatusBadge>
                </Td>
                <Td>
                  <Can permission="topics.manage">
                    <div className="flex gap-2">
                      <Button onClick={() => open(topic, valuesOf(topic))}>{copy.edit}</Button>
                      <Button onClick={() => toggleActive(topic)}>
                        {topic.is_active ? ui.common.deactivate : ui.common.activate}
                      </Button>
                    </div>
                  </Can>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      {templates.length > 0 && (
        <Section title={copy.templatesTitle}>
          <p className="mb-2 max-w-3xl text-sm text-neutral-600">{copy.templatesIntro}</p>
          <Table head={[copy.columns.name, copy.columns.category, copy.columns.keywords, ""]}>
            {templates.map((template) => (
              <tr key={template.id}>
                <Td>{template.name}</Td>
                <Td>{topicCategoryLabels[template.category]}</Td>
                <Td>{template.keywords.join(", ")}</Td>
                <Td>
                  <Can permission="topics.manage">
                    <Button onClick={() => open(null, valuesOf({ ...template, is_active: true }))}>{copy.useTemplate}</Button>
                  </Can>
                </Td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      <OfficialAccountsPanel />
    </>
  );
}

function TopicForm({ seed, onDone, onCancel }: { seed: Seed; onDone: () => void; onCancel: () => void }) {
  const [values, setValues] = useState<FormValues>(seed.values);
  const [pending, setPending] = useState(false);
  const [fields, setFields] = useState<string[]>([]);
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const keywords = parseKeywords(values.keywordsText);
  const placeholder = hasPlaceholder(values.keywordsText);
  const editing = seed.topic !== null;

  function change<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFields([]);
    setCodes([]);
    setError(null);
    try {
      await api(editing ? `topics/${seed.topic!.id}` : "topics", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({
          name: values.name.trim(),
          category: values.category,
          sensitivity: values.sensitivity,
          keywords,
          is_active: values.is_active,
        }),
      });
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setFields(invalidFields(e.body));
        setCodes(errorCodes(e.body));
      } else {
        setError(ui.common.actionError);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label={copy.form.name}>
          <input
            name="name"
            required
            maxLength={150}
            value={values.name}
            onChange={(e) => change("name", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label={copy.form.category}>
        <select name="category" value={values.category} onChange={(e) => change("category", e.target.value as TopicCategory)} className={inputClass}>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {topicCategoryLabels[category]}
            </option>
          ))}
        </select>
      </Field>
      <Field label={copy.form.sensitivity}>
        <select
          name="sensitivity"
          value={values.sensitivity}
          onChange={(e) => change("sensitivity", e.target.value as TopicSensitivity)}
          className={inputClass}
        >
          {SENSITIVITIES.map((sensitivity) => (
            <option key={sensitivity} value={sensitivity}>
              {sensitivityLabels[sensitivity]}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs font-normal text-neutral-500">{copy.form.sensitivityHint}</span>
      </Field>
      <div className="sm:col-span-2">
        <Field label={copy.form.keywords}>
          <textarea
            name="keywords"
            required
            rows={5}
            value={values.keywordsText}
            aria-invalid={placeholder}
            onChange={(e) => change("keywordsText", e.target.value)}
            className={`${inputClass} ${placeholder ? "border-red-500" : ""}`}
          />
          <span className="mt-1 block text-xs font-normal text-neutral-500">{copy.form.keywordsHint}</span>
        </Field>
        {placeholder && <p className="mt-1 text-sm text-red-600">{copy.placeholderWarning}</p>}
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="is_active" checked={values.is_active} onChange={(e) => change("is_active", e.target.checked)} />
        {copy.form.active}
      </label>
      <div className="space-y-2 sm:col-span-2">
        <FieldErrors fields={fields} />
        {codes.map((code) => copy.errors[code] && <ErrorText key={code}>{copy.errors[code]}</ErrorText>)}
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={pending || placeholder || keywords.length === 0 || values.name.trim() === ""}>
            {pending ? ui.common.saving : editing ? copy.form.save : copy.form.create}
          </Button>
          {(editing || values !== seed.values) && (
            <Button type="button" onClick={onCancel} disabled={pending}>
              {copy.form.cancel}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
