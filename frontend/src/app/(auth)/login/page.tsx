import { Shield, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/shell/brand-mark";
import { ui } from "@/lib/labels";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen flex-1 flex-col items-center justify-center bg-paper px-4 py-12 sm:px-6">
      {/* Ambient background decoration */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 size-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-32 right-1/4 size-80 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Top Institutional Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3.5 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 ring-4 ring-blue-500/10">
            <BrandMark className="size-8" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight text-ink">{ui.shell.brand}</span>
            <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand border border-brand/20">
              v2.0
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Sistem Peringatan Dini Isu, Koordinasi Akun &amp; Peniruan Identitas
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand-tint/80 px-3 py-1 text-caption font-semibold text-brand">
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>Kartika Cyber Hackathon 2026 · Kategori 04 Siber Sosial</span>
          </div>
        </div>

        {/* Modern Card */}
        <div className="relative overflow-hidden rounded-2xl border border-line bg-panel p-6 sm:p-8 shadow-xl shadow-slate-200/50">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500" />
          <div className="mb-6 border-b border-line pb-4 text-center">
            <h1 className="text-xl font-bold text-ink">{ui.login.title}</h1>
            <p className="mt-1 text-caption text-ink-muted">{ui.login.subtitle}</p>
          </div>
          <LoginForm />
        </div>

        {/* Institutional Footer */}
        <div className="mt-6 flex flex-col items-center text-center text-caption text-ink-muted">
          <div className="flex items-center gap-1.5 font-medium">
            <Shield className="size-3.5 text-brand" aria-hidden="true" />
            <span>{ui.shell.footer}</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-muted/80">
            Akses Terbatas · Enkripsi Sesi Aktif · Seluruh Aktivitas Dicatat di Audit Log
          </p>
        </div>
      </div>
    </main>
  );
}
