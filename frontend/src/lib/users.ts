// F12: aturan kecil halaman Pengguna (logika murni, dengan tes).

import type { RoleSlug, User } from "@/lib/api-types/users";
import { ui } from "@/lib/labels";

export type UserFormValues = { name: string; email: string; password: string; role: RoleSlug; is_active: boolean };

export function emptyUserForm(): UserFormValues {
  return { name: "", email: "", password: "", role: "analyst", is_active: true };
}

export function formFromUser(user: User): UserFormValues {
  return { name: user.name, email: user.email, password: "", role: user.role, is_active: user.is_active };
}

/**
 * POST /users takes name, email, password, role (new accounts are active).
 * PATCH /users/{id} takes only name, role, is_active; email and password are not editable here.
 */
export function userPayload(values: UserFormValues, mode: "create" | "edit"): Record<string, unknown> {
  if (mode === "create") return { name: values.name.trim(), email: values.email.trim(), password: values.password, role: values.role };
  return { name: values.name.trim(), role: values.role, is_active: values.is_active };
}

/**
 * Laravel sends English validation text; the UI shows an Indonesian message per field instead.
 * A 422 on `role` while editing yourself is the self-protection rule (PRD §8.4), not an invalid choice.
 */
export function userFieldErrors(body: { errors?: Record<string, string[]> } | null, editingSelf: boolean): Record<string, string> {
  const messages = ui.users.fieldErrors;
  const out: Record<string, string> = {};
  for (const field of Object.keys(body?.errors ?? {})) {
    if (field === "role" && editingSelf) out.role = messages.role_self;
    else if (field in messages) out[field] = messages[field as keyof typeof messages];
    else out[field] = ui.common.actionError;
  }
  return out;
}

export type UserSummary = { total: number; active: number; byRole: Record<RoleSlug, number> };

/**
 * Active count and role mix, only when the whole list is on this page (last_page 1).
 * A partial page would give misleading counts, so it returns null then.
 */
export function userSummary(page: { data: Pick<User, "role" | "is_active">[]; meta: { last_page: number; total: number } }): UserSummary | null {
  if (page.meta.last_page !== 1) return null;
  const byRole = { admin: 0, analyst: 0, leader: 0 } as Record<RoleSlug, number>;
  for (const user of page.data) byRole[user.role] = (byRole[user.role] ?? 0) + 1;
  return { total: page.meta.total, active: page.data.filter((u) => u.is_active).length, byRole };
}

export function usersQuery(page: number): string {
  return `users?per_page=50&page=${Math.max(1, page)}`;
}
