"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { roleLabels, ui } from "@/lib/labels";
import { useCan, useMe } from "@/components/permissions-provider";
import { BrandMark } from "./brand-mark";
import { isActive, visibleGroups } from "./nav-config";

/**
 * Isi sidebar gaya Able Pro (elegan, bersih, modern, dengan profil pengguna di bagian bawah dan navigasi presisi).
 */
export function SidebarContent({ compact, onNavigate }: { compact: boolean; onNavigate?: () => void }) {
  const me = useMe();
  const can = useCan();
  const pathname = usePathname();
  const groups = visibleGroups(can);
  const label = compact ? "sr-only" : "";

  return (
    <div className="flex h-full flex-col bg-panel text-ink border-r border-line select-none">
      {/* Brand Header */}
      <div
        className={cn(
          "flex h-16 items-center gap-3 border-b border-line px-4",
          compact && "justify-center px-0",
        )}
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white ring-4 ring-blue-500/10 transition-transform duration-200 hover:scale-105">
          <BrandMark className="size-5.5 text-white" />
        </div>
        <div className={cn("min-w-0 flex-1", label)}>
          <span className="block font-sans text-base font-bold tracking-tight text-ink">
            {ui.shell.brand}
          </span>
          <span className="block text-[11px] font-medium text-ink-muted truncate">
            Sistem Siber Sosial
          </span>
        </div>
      </div>

      {/* Nav List */}
      <nav
        aria-label={ui.shell.mainNavigation}
        className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4"
      >
        {groups.map((group) => (
          <div key={group.id} className="space-y-1">
            <div
              className={cn(
                "flex items-center gap-2 px-2.5 pt-2 pb-1 text-[10.5px] font-extrabold uppercase tracking-wider text-ink-muted/80",
                compact && "sr-only",
              )}
            >
              <span className="size-1 rounded-full bg-slate-300" aria-hidden="true" />
              <span>{ui.navGroups[group.id]}</span>
            </div>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      title={compact ? ui.navItems[item.id] : undefined}
                      aria-current={active ? "page" : undefined}
                      onClick={onNavigate}
                      className={cn(
                        "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-150",
                        compact && "justify-center px-0",
                        active
                          ? "bg-blue-600 text-white font-semibold ring-1 ring-blue-700"
                          : "text-ink-muted hover:bg-hover hover:text-ink hover:translate-x-0.5",
                      )}
                    >
                      <Icon
                        aria-hidden="true"
                        className={cn(
                          "size-4.5 shrink-0 transition-transform duration-150 group-hover:scale-110",
                          active ? "text-white" : "text-ink-muted group-hover:text-blue-600",
                        )}
                      />
                      <span className={cn("truncate flex-1", label)}>
                        {ui.navItems[item.id]}
                      </span>
                      {active && !compact && (
                        <ChevronRight
                          className="size-4 shrink-0 text-white/80 transition-transform"
                          aria-hidden="true"
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User Profile Box di Bagian Bawah */}
      {!compact ? (
        <div className="mt-auto border-t border-line p-3">
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper/80 p-2.5 hover:border-line-input transition-colors">
            <div className="relative size-10 shrink-0">
              <div className="flex h-full w-full items-center justify-center rounded-xl bg-blue-600 font-sans text-xs font-bold text-white ring-2 ring-blue-100">
                {me.user.name.charAt(0).toUpperCase()}
              </div>
              <span
                className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-teal-500 ring-2 ring-white"
                title="Sesi Aktif"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="block truncate text-xs font-bold text-ink">
                  {me.user.name}
                </span>
                <ShieldCheck className="size-3.5 text-blue-600 shrink-0" aria-hidden="true" />
              </div>
              <div className="mt-0.5">
                <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                  {roleLabels[me.role.slug]}
                </span>
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] text-ink-muted/80 leading-tight">
            {ui.shell.footer}
          </p>
        </div>
      ) : (
        <div className="mt-auto border-t border-line p-3 flex flex-col items-center gap-2">
          <div className="relative size-9">
            <div className="flex h-full w-full items-center justify-center rounded-xl bg-blue-600 font-sans text-xs font-bold text-white ring-2 ring-blue-100">
              {me.user.name.charAt(0).toUpperCase()}
            </div>
            <span
              className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-teal-500 ring-2 ring-white"
              title={me.user.name}
            />
          </div>
        </div>
      )}
    </div>
  );
}
