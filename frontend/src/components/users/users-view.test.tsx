import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/admin/users" }));

import { USER_PAGE, USERS } from "@/fixtures/users";
import { ui } from "@/lib/labels";
import { emptyUserForm, formFromUser, userFieldErrors, userPayload, usersQuery, userSummary } from "@/lib/users";
import { UsersView, type UserFormState, type UsersViewProps } from "./users-view";

const noop = () => undefined;
const closed: UserFormState = { open: false, mode: "create", userId: null, values: emptyUserForm(), errors: {}, pending: false, failed: false };
const base: UsersViewProps = {
  result: USER_PAGE,
  loading: false,
  failed: false,
  canManage: true,
  currentUserId: 1,
  onPageChange: noop,
  onNew: noop,
  onEdit: noop,
  form: closed,
  onFormChange: noop,
  onFormSubmit: noop,
  onFormClose: noop,
};
const render = (props: Partial<UsersViewProps> = {}) => renderToString(createElement(UsersView, { ...base, ...props }));

describe("user payloads and errors", () => {
  it("creates with email and password, edits only name, role, and activation", () => {
    const values = { ...emptyUserForm(), name: " Rina ", email: " rina@x.test ", password: "rahasia-123", role: "leader" as const };
    expect(userPayload(values, "create")).toEqual({ name: "Rina", email: "rina@x.test", password: "rahasia-123", role: "leader" });
    expect(userPayload({ ...formFromUser(USERS[1]), is_active: false }, "edit")).toEqual({ name: "Analis Demo", role: "analyst", is_active: false });
  });

  it("translates 422 fields to Indonesian, including the self-protection rule", () => {
    expect(userFieldErrors({ errors: { email: ["The email has already been taken."], password: ["min"] } }, false)).toEqual({
      email: ui.users.fieldErrors.email,
      password: ui.users.fieldErrors.password,
    });
    expect(userFieldErrors({ errors: { is_active: ["You cannot deactivate your own account."] } }, true).is_active).toBe(ui.users.fieldErrors.is_active);
    expect(userFieldErrors({ errors: { role: ["You cannot change your own role."] } }, true).role).toBe(ui.users.fieldErrors.role_self);
    expect(userFieldErrors({ errors: { role: ["invalid"] } }, false).role).toBe(ui.users.fieldErrors.role);
  });

  it("pages through the list 50 at a time", () => {
    expect(usersQuery(0)).toBe("users?per_page=50&page=1");
    expect(usersQuery(3)).toBe("users?per_page=50&page=3");
  });
});

describe("user summary", () => {
  it("counts active accounts and roles when the whole list is on one page", () => {
    expect(userSummary(USER_PAGE)).toEqual({ total: 4, active: 3, byRole: { admin: 1, analyst: 2, leader: 1 } });
  });

  it("gives no counts for a partial page, so they never mislead", () => {
    expect(userSummary({ ...USER_PAGE, meta: { ...USER_PAGE.meta, last_page: 2, total: 80 } })).toBeNull();
  });
});

describe("UsersView", () => {
  it("lists users with role labels, marks the signed-in user, and shows never-logged-in accounts", () => {
    const html = render();
    expect(html).toContain("Pimpinan");
    expect(html).toContain(`(${ui.users.you})`);
    expect(html).toContain(ui.users.never);
  });

  it("hides add and edit without users.manage", () => {
    const html = render({ canManage: false });
    expect(html).not.toContain(ui.users.newUser);
    expect(html).not.toContain(`>${ui.users.edit}</button>`);
  });

  it("keeps the active switch for your own account and shows the 422 under it", () => {
    const html = render({ form: { ...closed, open: true, mode: "edit", userId: 1, values: { ...formFromUser(USERS[0]), is_active: false }, errors: { is_active: ui.users.fieldErrors.is_active } } });
    expect(html).toContain(ui.users.isActive);
    expect(html).toContain(ui.users.fieldErrors.is_active);
  });

  it("asks for email and password only when creating", () => {
    const create = render({ form: { ...closed, open: true } });
    expect(create).toContain('name="password"');
    const edit = render({ form: { ...closed, open: true, mode: "edit", userId: 2, values: formFromUser(USERS[1]) } });
    expect(edit).not.toContain('name="password"');
  });

  it("shows account status with icon and text, and the role mix in the summary", () => {
    const html = render();
    expect(html).toContain(ui.users.inactive);
    expect(html).toContain(ui.users.summary.active("3"));
    expect(html).toContain(ui.users.summary.role("Analis", "2"));
  });

  it("states that there are no users", () => {
    expect(render({ result: { data: [], meta: { current_page: 1, last_page: 1, per_page: 50, total: 0 } } })).toContain(ui.users.empty);
  });
});
