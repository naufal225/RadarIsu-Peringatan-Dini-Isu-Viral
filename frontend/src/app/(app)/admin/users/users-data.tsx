"use client";

import { useState } from "react";
import { useCan, useMe } from "@/components/permissions-provider";
import { UsersView, type UserFormState } from "@/components/users/users-view";
import { api, ApiError } from "@/lib/api";
import type { UserPage } from "@/lib/api-types/users";
import { emptyUserForm, formFromUser, userFieldErrors, userPayload, usersQuery } from "@/lib/users";
import { useApiData } from "@/lib/use-api-data";

const CLOSED: UserFormState = { open: false, mode: "create", userId: null, values: emptyUserForm(), errors: {}, pending: false, failed: false };

/** Pengambil data /admin/users. */
export function UsersData() {
  const can = useCan();
  const me = useMe();
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApiData<UserPage>(usersQuery(page));
  const [form, setForm] = useState<UserFormState>(CLOSED);

  async function submit() {
    setForm((f) => ({ ...f, pending: true, errors: {}, failed: false }));
    try {
      if (form.mode === "create") await api("users", { method: "POST", body: JSON.stringify(userPayload(form.values, "create")) });
      else await api(`users/${form.userId}`, { method: "PATCH", body: JSON.stringify(userPayload(form.values, "edit")) });
      setForm(CLOSED);
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setForm((f) => ({ ...f, pending: false, errors: userFieldErrors(e.body, f.userId === me.user.id) }));
      else setForm((f) => ({ ...f, pending: false, failed: true }));
    }
  }

  return (
    <UsersView
      result={data}
      loading={loading}
      failed={error && data === null}
      onRetry={reload}
      canManage={can("users.manage")}
      currentUserId={me.user.id}
      onPageChange={setPage}
      onNew={() => setForm({ ...CLOSED, open: true })}
      onEdit={(user) => setForm({ ...CLOSED, open: true, mode: "edit", userId: user.id, values: formFromUser(user) })}
      form={form}
      onFormChange={(values) => setForm((f) => ({ ...f, values }))}
      onFormSubmit={submit}
      onFormClose={() => setForm(CLOSED)}
    />
  );
}
