"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ui } from "@/lib/labels";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-panel px-3.5 text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-colors shadow-xs active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <span className="size-3.5 animate-spin rounded-full border-2 border-rose-600 border-t-transparent" />
      ) : (
        <LogOut aria-hidden="true" className="size-3.5" />
      )}
      <span>{ui.logout}</span>
    </button>
  );
}
