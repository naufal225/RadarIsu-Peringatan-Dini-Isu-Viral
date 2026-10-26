"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ui } from "@/lib/labels";
import type { Permission } from "@/lib/permissions";
import { useCan } from "./permissions-provider";

const LINKS: { href: string; label: string; permission: Permission }[] = [
  { href: "/dashboard", label: ui.nav.dashboard, permission: "dashboard.view" },
  { href: "/topics", label: ui.nav.topics, permission: "topics.view" },
  { href: "/alerts", label: ui.nav.alerts, permission: "alerts.view" },
  { href: "/briefings", label: ui.nav.briefings, permission: "briefings.view" },
  { href: "/admin/status", label: ui.nav.status, permission: "system.status" },
  { href: "/admin/users", label: ui.nav.users, permission: "users.view" },
  { href: "/admin/sources", label: ui.nav.sources, permission: "sources.view" },
  { href: "/admin/replay", label: ui.nav.replay, permission: "replay.manage" },
  { href: "/admin/audit", label: ui.nav.audit, permission: "audit.view" },
  { href: "/admin/settings", label: ui.nav.settings, permission: "settings.manage" },
];

export function AppNav() {
  const can = useCan();
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-neutral-200 px-6 text-sm">
      {LINKS.filter((link) => can(link.permission)).map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`border-b-2 px-3 py-2 ${active ? "border-neutral-900 font-medium" : "border-transparent text-neutral-600 hover:text-neutral-900"}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
