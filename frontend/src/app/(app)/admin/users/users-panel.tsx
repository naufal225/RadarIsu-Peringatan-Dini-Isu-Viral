"use client";

import { useState, type FormEvent } from "react";
import { Can, useMe } from "@/components/permissions-provider";
import { Button, ErrorText, Field, FieldErrors, inputClass, PageTitle, Section, StatusBadge, Table, Td } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, invalidFields } from "@/lib/format";
import { roleLabels, ui } from "@/lib/labels";
import { ROLES, type RoleSlug } from "@/lib/permissions";
import { useApiData } from "@/lib/use-api-data";

type User = {
  id: number;
  name: string;
  email: string;
  role: RoleSlug;
  is_active: boolean;
  last_login_at: string | null;
};

export function UsersPanel() {
  const me = useMe();
  const { data, error: loadError, reload } = useApiData<{ data: User[] }>("users?per_page=100");
  const users = data?.data ?? null;
  const [error, setError] = useState<string | null>(null);

  async function update(user: User, changes: Partial<Pick<User, "role" | "is_active">>) {
    setError(null);
    try {
      await api(`users/${user.id}`, { method: "PATCH", body: JSON.stringify(changes) });
      reload();
    } catch {
      setError(ui.common.actionError);
    }
  }

  return (
    <>
      <PageTitle>{ui.users.title}</PageTitle>
      <ErrorText>{loadError ? ui.common.loadError : error}</ErrorText>

      <Section title={ui.users.title}>
        {users === null ? (
          <p className="text-sm text-neutral-500">{ui.loading}</p>
        ) : (
          <Table head={[ui.users.name, ui.users.email, ui.users.role, ui.users.status, ui.users.lastLogin, ""]}>
            {users.map((user) => {
              const self = user.id === me.user.id; // the API also refuses self-demotion/deactivation (422)
              return (
                <tr key={user.id}>
                  <Td>{user.name}</Td>
                  <Td>{user.email}</Td>
                  <Td>
                    <Can permission="users.manage" fallback={roleLabels[user.role]}>
                      <select
                        className={inputClass}
                        value={user.role}
                        disabled={self}
                        onChange={(e) => update(user, { role: e.target.value as RoleSlug })}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {roleLabels[role]}
                          </option>
                        ))}
                      </select>
                    </Can>
                  </Td>
                  <Td>
                    <StatusBadge tone={user.is_active ? "ok" : "muted"}>
                      {user.is_active ? ui.common.active : ui.common.inactive}
                    </StatusBadge>
                  </Td>
                  <Td>{formatDateTime(user.last_login_at)}</Td>
                  <Td>
                    <Can permission="users.manage">
                      {!self && (
                        <Button onClick={() => update(user, { is_active: !user.is_active })}>
                          {user.is_active ? ui.common.deactivate : ui.common.activate}
                        </Button>
                      )}
                    </Can>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Section>

      <Can permission="users.manage">
        <Section title={ui.users.newUser}>
          <NewUserForm onCreated={reload} />
        </Section>
      </Can>
    </>
  );
}

function NewUserForm({ onCreated }: { onCreated: () => void }) {
  const [pending, setPending] = useState(false);
  const [fields, setFields] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setFields([]);
    setError(null);
    try {
      await api("users", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          password: data.get("password"),
          role: data.get("role"),
        }),
      });
      form.reset();
      onCreated();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setFields(invalidFields(e.body));
      else setError(ui.common.actionError);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid max-w-xl gap-3 sm:grid-cols-2">
      <Field label={ui.users.name}>
        <input name="name" required maxLength={120} className={inputClass} />
      </Field>
      <Field label={ui.users.email}>
        <input name="email" type="email" required maxLength={190} className={inputClass} />
      </Field>
      <Field label={ui.users.password}>
        <input name="password" type="password" required minLength={10} autoComplete="new-password" className={inputClass} />
      </Field>
      <Field label={ui.users.role}>
        <select name="role" defaultValue="analyst" className={inputClass}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {roleLabels[role]}
            </option>
          ))}
        </select>
      </Field>
      <div className="sm:col-span-2 space-y-2">
        <FieldErrors fields={fields} />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? ui.common.saving : ui.common.add}
        </Button>
      </div>
    </form>
  );
}
