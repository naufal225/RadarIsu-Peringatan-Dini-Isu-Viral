"use client";

import { useState, type FormEvent } from "react";
import { Can } from "@/components/permissions-provider";
import { Button, ErrorText, Field, FieldErrors, inputClass, Section, Table, Td } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { invalidFields } from "@/lib/format";
import { ui } from "@/lib/labels";
import { type OfficialAccount } from "@/lib/topics";
import { useApiData } from "@/lib/use-api-data";

const copy = ui.topics.officialAccounts;

export function OfficialAccountsPanel() {
  const { data, error: loadError, reload } = useApiData<{ data: OfficialAccount[] }>("official-accounts");
  const accounts = data?.data ?? null;
  const [error, setError] = useState<string | null>(null);

  async function remove(account: OfficialAccount) {
    setError(null);
    try {
      await api(`official-accounts/${account.id}`, { method: "DELETE" });
      reload();
    } catch {
      setError(ui.common.actionError);
    }
  }

  return (
    <Section title={copy.title}>
      <p className="mb-2 max-w-3xl text-sm text-neutral-600">{copy.intro}</p>
      <ErrorText>{loadError ? ui.common.loadError : error}</ErrorText>

      {accounts === null ? (
        <p className="text-sm text-neutral-500">{ui.loading}</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-neutral-500">{copy.empty}</p>
      ) : (
        <Table head={[copy.handle, copy.displayName, copy.note, ""]}>
          {accounts.map((account) => (
            <tr key={account.id}>
              <Td>{account.handle}</Td>
              <Td>{account.display_name}</Td>
              <Td>{account.note ?? ui.common.none}</Td>
              <Td>
                <Can permission="topics.manage">
                  <Button onClick={() => remove(account)}>{copy.remove}</Button>
                </Can>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Can permission="topics.manage">
        <div className="mt-4">
          <NewAccountForm onCreated={reload} />
        </div>
      </Can>
    </Section>
  );
}

function NewAccountForm({ onCreated }: { onCreated: () => void }) {
  const [pending, setPending] = useState(false);
  const [fields, setFields] = useState<string[]>([]);
  const [duplicate, setDuplicate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setFields([]);
    setDuplicate(false);
    setError(null);
    try {
      await api("official-accounts", {
        method: "POST",
        body: JSON.stringify({
          handle: data.get("handle"),
          display_name: data.get("display_name"),
          note: data.get("note") || null,
        }),
      });
      form.reset();
      onCreated();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setFields(invalidFields(e.body));
        // The API answers with Laravel's "has already been taken" for the unique handle.
        setDuplicate(e.body?.errors?.handle?.some((message) => /taken/i.test(message)) ?? false);
      } else {
        setError(ui.common.actionError);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid max-w-3xl gap-3 sm:grid-cols-3">
      <Field label={copy.handle}>
        <input name="handle" required maxLength={190} className={inputClass} />
      </Field>
      <Field label={copy.displayName}>
        <input name="display_name" required maxLength={190} className={inputClass} />
      </Field>
      <Field label={copy.note}>
        <input name="note" maxLength={255} className={inputClass} />
      </Field>
      <div className="space-y-2 sm:col-span-3">
        <FieldErrors fields={fields} />
        {duplicate && <ErrorText>{copy.duplicate}</ErrorText>}
        <ErrorText>{error}</ErrorText>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? ui.common.saving : copy.add}
        </Button>
      </div>
    </form>
  );
}
