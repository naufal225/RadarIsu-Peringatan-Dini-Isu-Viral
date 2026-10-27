"use client";

import { useState } from "react";
import { PageHeader } from "@/components/radar/page-header";
import { UsersView, type UserFormState, type UsersViewProps } from "@/components/users/users-view";
import { USER_PAGE } from "@/fixtures/users";
import { ui } from "@/lib/labels";
import { emptyUserForm, formFromUser, userFieldErrors } from "@/lib/users";

const noop = () => undefined;
const CLOSED: UserFormState = { open: false, mode: "create", userId: null, values: emptyUserForm(), errors: {}, pending: false, failed: false };

const BASE: UsersViewProps = {
  result: USER_PAGE,
  loading: false,
  failed: false,
  onRetry: noop,
  canManage: true,
  currentUserId: 1,
  onPageChange: noop,
  onNew: noop,
  onEdit: noop,
  form: CLOSED,
  onFormChange: noop,
  onFormSubmit: noop,
  onFormClose: noop,
};

const CASES: { title: string; props: Partial<UsersViewProps> }[] = [
  { title: ui.preview.normal, props: {} },
  { title: `${ui.preview.normal} · ${ui.users.no} ${ui.users.actions}`, props: { canManage: false } },
  { title: ui.preview.empty, props: { result: { data: [], meta: { current_page: 1, last_page: 1, per_page: 50, total: 0 } } } },
  { title: ui.preview.loading, props: { result: null, loading: true } },
  { title: ui.preview.error, props: { result: null, failed: true } },
];

/**
 * /dev/preview/users: UsersView dengan fixture. Kasus pertama interaktif: "Tambah pengguna" lalu Simpan
 * memunculkan contoh 422 per bidang; "Ubah" pada akun sendiri lalu Simpan memunculkan 422 penonaktifan diri.
 */
export function UsersPreview() {
  const [form, setForm] = useState<UserFormState>(CLOSED);

  function fakeSubmit() {
    const self = form.userId === 1;
    const body: { errors: Record<string, string[]> } = form.mode === "create" ? { errors: { email: ["taken"], password: ["min"] } } : self ? { errors: { is_active: ["self"] } } : { errors: {} };
    setForm((f) => ({ ...f, errors: userFieldErrors(body, self) }));
  }

  return (
    <>
      <PageHeader title={ui.preview.title(ui.users.title)} subtitle={ui.preview.subtitle} />
      {CASES.map(({ title, props }, index) => (
        <section key={title} className="mb-12 border-t border-line pt-6">
          <h2 className="mb-4 text-section font-semibold text-ink-muted">{title}</h2>
          <UsersView
            {...BASE}
            {...(index === 0
              ? {
                  form,
                  onNew: () => setForm({ ...CLOSED, open: true }),
                  onEdit: (u) => setForm({ ...CLOSED, open: true, mode: "edit", userId: u.id, values: { ...formFromUser(u), is_active: u.id === 1 ? false : u.is_active } }),
                  onFormChange: (values) => setForm((f) => ({ ...f, values })),
                  onFormSubmit: fakeSubmit,
                  onFormClose: () => setForm(CLOSED),
                }
              : {})}
            {...props}
          />
        </section>
      ))}
    </>
  );
}
