"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/labels";
import { useCan } from "@/components/permissions-provider";
import { BrandMark } from "./brand-mark";
import { isActive, visibleGroups } from "./nav-config";

/**
 * Isi sidebar. `compact` = hanya ikon (layar 768-1279 px): label disembunyikan secara visual tetapi
 * tetap ada untuk pembaca layar, dan `title` menjadi tooltip.
 */
export function SidebarContent({ compact, onNavigate }: { compact: boolean; onNavigate?: () => void }) {
  const can = useCan();
  const pathname = usePathname();
  const groups = visibleGroups(can);
  const label = compact ? "sr-only" : "";

  return (
    <div className="on-dark flex h-full flex-col bg-sidebar text-sidebar-fg">
      <div className={cn("flex h-14 items-center gap-2 border-b border-brand px-4", compact && "justify-center px-0")}>
        <BrandMark className="size-7 shrink-0" />
        <span className={cn("font-serif text-lead font-semibold", label)}>{ui.shell.brand}</span>
      </div>

      <nav aria-label={ui.shell.mainNavigation} className="flex-1 overflow-y-auto py-3">
        {groups.map((group, index) => (
          <div key={group.id} className={cn(index > 0 && "mt-4")}>
            <p className={cn("px-4 pb-1 text-caption font-medium uppercase tracking-wide text-sidebar-muted", compact && "sr-only")}>
              {ui.navGroups[group.id]}
            </p>
            <ul>
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
                        "flex h-10 items-center gap-3 border-l-3 px-4 text-sm transition-colors duration-150",
                        compact && "justify-center px-0",
                        active ? "border-sidebar-fg bg-brand font-medium" : "border-transparent text-sidebar-fg hover:bg-brand",
                      )}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      <span className={label}>{ui.navItems[item.id]}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <p className={cn("border-t border-brand px-4 py-3 text-caption text-sidebar-muted", compact && "sr-only")}>{ui.shell.footer}</p>
    </div>
  );
}
