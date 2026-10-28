"use client";

import { CircleCheck, CircleSlash } from "lucide-react";
import type { FormEvent } from "react";
import { Button } from "@/components/radar/button";
import { DataTable, type DataTableColumn } from "@/components/radar/data-table";
import { Dialog } from "@/components/radar/dialog";
import { checkboxClass, controlClass, Field, FieldError } from "@/components/radar/form";
import { PageHeader } from "@/components/radar/page-header";
import { Pagination } from "@/components/radar/pagination";
import { EmptyState } from "@/components/radar/states";
import { Waktu } from "@/components/radar/waktu";
import type { RoleSlug, User, UserPage } from "@/lib/api-types/users";
import { cn } from "@/lib/cn";
import { formatInteger } from "@/lib/format";
import { roleLabels, ui } from "@/lib/labels";
import { userSummary, type UserFormValues } from "@/lib/users";

const copy = ui.users;

export type UserFormState = {
  open: boolean;
  mode: "create" | "edit";
  userId: number | null;
  values: UserFormValues;
  /** Indonesian message per field (from a 422). */
  errors: Record<string, string>;
  pending: boolean;
  failed: boolean;
};

export type UsersViewProps = {
  result: UserPage | null;
  loading: boolean;
  failed: boolean;
  onRetry?: () => void;
  canManage: boolean;
  /** The signed-in user, to mark "Anda" in the table. */
  currentUserId: number;
  onPageChange: (page: number) => void;
  onNew: () => void;
  onEdit: (user: User) => void;
  form: UserFormState;
  onFormChange: (values: UserFormValues) => void;
  onFormSubmit: () => void;
  onFormClose: () => void;
};

/** Status akun monokrom: ikon + teks (Design System §2 #5, #6). */
function AccountStatus({ active }: { active: boolean }) {
  const Icon = active ? CircleCheck : CircleSlash;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", active ? "text-ink" : "text-ink-muted")}>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {active ? copy.active : copy.inactive}
    </span>
  );
}

/** Jumlah aktif dan komposisi peran, hanya bila seluruh daftar ada di halaman ini (lib/users.ts). */
function Summary({ result }: { result: UserPage }) {
  const summary = userSummary(result);
  const text = copy.summary;
  if (!summary) return <p className="mb-3 text-table text-ink-muted">{text.total(formatInteger(result.meta.total))}</p>;
  const parts = [
    text.total(formatInteger(summary.total)),
    text.active(formatInteger(summary.active)),
    ...(Object.keys(roleLabels) as RoleSlug[]).map((role) => text.role(roleLabels[role], formatInteger(summary.byRole[role]))),
  ];
  return (
    <p aria-label={text.label} className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-table text-ink-muted">
      {parts.map((part, index) => (
        <span key={part} className="whitespace-nowrap">
          {index > 0 && <span aria-hidden="true" className="mr-2">·</span>}
          {part}
        </span>
      ))}
    </p>
  );
}

/** Halaman Polos dengan komponen fondasi (docs/UI_PAGES.md, /admin/users). */
export function UsersView(props: UsersViewProps) {
  const { result, loading, failed, onRetry, canManage, currentUserId } = props;

  const columns: DataTableColumn<User>[] = [
    {
      id: "name",
      header: copy.name,
      cell: (u) => (
        <div className="py-1.5">
          <span className={cn("block font-medium", u.is_active ? "text-ink" : "text-ink-muted")}>
            {u.name}
            {u.id === currentUserId && <span className="ml-2 text-caption font-normal text-ink-muted">{`(${copy.you})`}</span>}
          </span>
          <span className="block font-mono text-caption text-ink-muted">{u.email}</span>
        </div>
      ),
    },
    { id: "role", header: copy.role, cell: (u) => <span className="whitespace-nowrap">{roleLabels[u.role]}</span> },
    { id: "status", header: copy.status, cell: (u) => <AccountStatus active={u.is_active} /> },
    { id: "login", header: copy.lastLogin, cell: (u) => (u.last_login_at ? <Waktu value={u.last_login_at} /> : <span className="text-ink-muted">{copy.never}</span>) },
  ];
  if (canManage) {
    columns.push({
      id: "actions",
      header: <span className="sr-only">{copy.actions}</span>,
      align: "right",
      cell: (u) => (
        <Button size="sm" variant="ghost" onClick={() => props.onEdit(u)}>
          {copy.edit}
        </Button>
      ),
    });
  }

  return (
    <>
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        actions={canManage ? <Button variant="primary" onClick={props.onNew}>{copy.newUser}</Button> : undefined}
      />
      {result && result.data.length > 0 && <Summary result={result} />}
      <DataTable
        columns={columns}
        rows={result?.data ?? []}
        getRowKey={(u) => u.id}
        loading={loading && result === null}
        error={failed ? { onRetry } : null}
        caption={copy.tableCaption}
        empty={<EmptyState title={copy.empty} />}
      />
      {result && result.data.length > 0 && (
        <Pagination page={result.meta.current_page} perPage={result.meta.per_page} total={result.meta.total} onPageChange={props.onPageChange} />
      )}
      {canManage && <UserFormDialog {...props} />}
    </>
  );
}

function UserFormDialog({ form, onFormChange, onFormSubmit, onFormClose }: UsersViewProps) {
  const { values, errors } = form;
  const set = (patch: Partial<UserFormValues>) => onFormChange({ ...values, ...patch });
  const creating = form.mode === "create";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onFormSubmit();
  }

  return (
    <Dialog open={form.open} title={creating ? copy.newUser : copy.editUser} onClose={onFormClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={copy.name} error={errors.name}>
          <input name="name" required maxLength={120} value={values.name} onChange={(e) => set({ name: e.target.value })} className={controlClass} />
        </Field>
        {creating ? (
          <>
            <Field label={copy.email} error={errors.email}>
              <input name="email" type="email" required maxLength={190} autoComplete="off" value={values.email} onChange={(e) => set({ email: e.target.value })} className={controlClass} />
            </Field>
            <Field label={copy.password} error={errors.password}>
              {/* Panjang minimal ditegakkan server (PRD §13); pesannya tampil di bawah bidang ini. */}
              <input name="password" type="password" required autoComplete="new-password" value={values.password} onChange={(e) => set({ password: e.target.value })} className={controlClass} />
            </Field>
          </>
        ) : (
          <p className="font-mono text-table text-ink-muted">{values.email}</p>
        )}
        <Field label={copy.role} error={errors.role}>
          <select name="role" value={values.role} onChange={(e) => set({ role: e.target.value as RoleSlug })} className={controlClass}>
            {(Object.keys(roleLabels) as RoleSlug[]).map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </select>
        </Field>
        {!creating && (
          // Tombol tidak disembunyikan untuk akun sendiri: server menolak dengan 422 dan pesannya tampil di sini.
          <div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="is_active" checked={values.is_active} onChange={(e) => set({ is_active: e.target.checked })} className={checkboxClass} />
              {copy.isActive}
            </label>
            {errors.is_active && <FieldError>{errors.is_active}</FieldError>}
          </div>
        )}
        {form.failed && <FieldError>{ui.common.actionError}</FieldError>}
        <div className="flex justify-end gap-2">
          <Button onClick={onFormClose} disabled={form.pending}>
            {copy.close}
          </Button>
          <Button type="submit" variant="primary" pending={form.pending}>
            {form.pending ? copy.saving : copy.save}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
