"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { useMe } from "@/components/permissions-provider";
import { roleLabels, ui } from "@/lib/labels";
import { SidebarContent } from "./sidebar";

/**
 * Kerangka halaman (Design System §7): sidebar 240 px, menciut jadi ikon di bawah 1280 px, dan menjadi
 * panel geser di bawah 768 px. Konten maksimal 1280 px, rata tengah.
 */
export function AppShell({ banner, children }: { banner?: ReactNode; children: ReactNode }) {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex min-h-screen">
      <a href="#konten" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-control focus:bg-panel focus:px-3 focus:py-2">
        {ui.shell.skipToContent}
      </a>

      {/* Desktop dan tablet: tetap di kiri. */}
      <aside className="sticky top-0 hidden h-screen w-16 shrink-0 md:block xl:w-60">
        <div className="h-full xl:hidden">
          <SidebarContent compact />
        </div>
        <div className="hidden h-full xl:block">
          <SidebarContent compact={false} />
        </div>
      </aside>

      {/* Ponsel: panel geser. */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" aria-label={ui.shell.closeMenu} className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="relative h-full w-60">
            <SidebarContent compact={false} onNavigate={() => setOpen(false)} />
            <button
              ref={closeRef}
              type="button"
              aria-label={ui.shell.closeMenu}
              onClick={() => setOpen(false)}
              className="on-dark absolute right-2 top-3 rounded-control p-1 text-sidebar-fg hover:bg-brand"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b border-line bg-panel px-4 md:px-8">
          <button
            type="button"
            aria-label={ui.shell.openMenu}
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="rounded-control p-1.5 text-ink hover:bg-hover md:hidden"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-right">
              <span className="block font-medium text-ink">{me.user.name}</span>
              <span className="block text-caption text-ink-muted">{roleLabels[me.role.slug]}</span>
            </span>
            <LogoutButton />
          </div>
        </header>

        {banner}

        <main id="konten" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
