// Daftar menu sidebar, didefinisikan satu kali (docs/UI_DESIGN_SYSTEM.md §7). Halaman lain tidak menambah menu.
// Teks menu ada di lib/labels/shell.ts. Menu disaring dengan izin, bukan nama peran.

import {
  Activity,
  ClipboardCheck,
  Database,
  FileText,
  Hash,
  LayoutDashboard,
  CirclePlay,
  ScrollText,
  Siren,
  SlidersHorizontal,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";
import { navGroupLabels, navItemLabels } from "@/lib/labels/shell";
import type { Permission } from "@/lib/permissions";

export type NavItemId = keyof typeof navItemLabels;
export type NavGroupId = keyof typeof navGroupLabels;

export type NavItem = { id: NavItemId; href: string; icon: LucideIcon; permission: Permission };
export type NavGroup = { id: NavGroupId; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "situation",
    items: [
      { id: "dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
      { id: "alerts", href: "/alerts", icon: Siren, permission: "alerts.view" },
      { id: "briefings", href: "/briefings", icon: FileText, permission: "briefings.view" },
    ],
  },
  { id: "monitoring", items: [{ id: "topics", href: "/topics", icon: Hash, permission: "topics.view" }] },
  {
    id: "quality",
    items: [
      { id: "labeling", href: "/labeling", icon: Tag, permission: "labels.manage" },
      { id: "evaluation", href: "/evaluation", icon: ClipboardCheck, permission: "evaluation.view" },
    ],
  },
  {
    id: "admin",
    items: [
      { id: "status", href: "/admin/status", icon: Activity, permission: "system.status" },
      { id: "sources", href: "/admin/sources", icon: Database, permission: "sources.view" },
      { id: "users", href: "/admin/users", icon: Users, permission: "users.view" },
      { id: "replay", href: "/admin/replay", icon: CirclePlay, permission: "replay.manage" },
      { id: "settings", href: "/admin/settings", icon: SlidersHorizontal, permission: "settings.manage" },
      { id: "audit", href: "/admin/audit", icon: ScrollText, permission: "audit.view" },
    ],
  },
];

/** Groups with only the items the user may open; groups left empty are dropped. */
export function visibleGroups(can: (permission: Permission) => boolean): NavGroup[] {
  return NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => can(item.permission)) })).filter(
    (group) => group.items.length > 0,
  );
}

/** Landing page after login: the dashboard when allowed, otherwise the system status page (admin). */
export function homePath(can: (permission: Permission) => boolean): string {
  if (can("dashboard.view")) return "/dashboard";
  if (can("system.status")) return "/admin/status";
  const first = visibleGroups(can)[0]?.items[0];
  return first?.href ?? "/dashboard";
}

/** True when `pathname` is the item's page or one beneath it. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
