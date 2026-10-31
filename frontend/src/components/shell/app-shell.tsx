"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { useMe } from "@/components/permissions-provider";
import { roleLabels, ui } from "@/lib/labels";
import { SidebarContent } from "./sidebar";

/**
 * Kerangka halaman modern (Able Pro style): sidebar 264 px putih bersih dengan border halus,
 * top navigation bar rapi, dan kanvas utama responsif.
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
    <div className="flex min-h-screen bg-paper">
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-control focus:bg-panel focus:px-3 focus:py-2"
      >
        {ui.shell.skipToContent}
      </a>

      {/* Desktop dan tablet: tetap di kiri dengan border pemisah rapi. */}
      <aside className="sticky top-0 hidden h-screen w-16 shrink-0 border-r border-line bg-panel md:block xl:w-[264px] z-30">
        <div className="h-full xl:hidden">
          <SidebarContent compact />
        </div>
        <div className="hidden h-full xl:block">
          <SidebarContent compact={false} />
        </div>
      </aside>

      {/* Ponsel: panel geser dengan backdrop halus. */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label={ui.shell.closeMenu}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setOpen(false)}
          />
          <div className="relative h-full w-[264px] bg-panel border-r border-line">
            <SidebarContent compact={false} onNavigate={() => setOpen(false)} />
            <button
              ref={closeRef}
              type="button"
              aria-label={ui.shell.closeMenu}
              onClick={() => setOpen(false)}
              className="absolute right-2.5 top-3.5 rounded-xl p-1.5 text-ink-muted hover:bg-hover hover:text-ink transition-colors"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-panel/95 backdrop-blur-md px-4 md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={ui.shell.openMenu}
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className="rounded-xl p-2 text-ink hover:bg-hover md:hidden transition-colors"
            >
              <Menu aria-hidden="true" className="size-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2.5 text-xs text-ink-muted">
              <span className="font-semibold text-ink">Kartika Cyber Hackathon 2026</span>
              <span className="text-slate-300">·</span>
              <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 font-semibold text-blue-700">
                Kategori 04 Siber Sosial
              </span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-blue-600 font-sans text-xs font-bold text-white ring-2 ring-blue-100">
                {me.user.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-right">
                <span className="block font-semibold text-ink text-xs">{me.user.name}</span>
                <span className="inline-block rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                  {roleLabels[me.role.slug]}
                </span>
              </span>
            </div>
            <div className="h-6 w-px bg-line" aria-hidden="true" />
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
