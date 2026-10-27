// /users (PRD §11, F12). Bentuk dari UserResource dan UserController, bukan dari harapan.

import type { roleLabels } from "@/lib/labels";

export type RoleSlug = keyof typeof roleLabels;

export type User = {
  id: number;
  name: string;
  email: string;
  role: RoleSlug;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
};

/** Laravel resource collection: paginated, ordered by name (per_page 1–100, default 50). */
export type UserPage = {
  data: User[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
};
