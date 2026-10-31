"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { ArrowRight, Lock, Mail, ShieldAlert, ShieldCheck, UserCheck } from "lucide-react";
import { ui } from "@/lib/labels";

const noopSubscribe = () => () => {};

/** false while rendering on the server and until React has hydrated this component in the browser. */
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

const DEMO_ACCOUNTS = [
  { role: "Analis", email: "analyst@radarisu.test", tag: "Investigasi" },
  { role: "Pimpinan", email: "leader@radarisu.test", tag: "Approval" },
  { role: "Admin", email: "admin@radarisu.test", tag: "Kelola Sistem" },
];

export function LoginForm() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  function fillDemo(demoEmail: string, role: string) {
    setEmail(demoEmail);
    setPassword("radarisu-demo-2026");
    setSelectedRole(role);
    setError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    }).catch(() => null);

    if (response?.ok) {
      router.replace("/");
      router.refresh();
      return;
    }

    setPending(false);
    setError(
      response?.status === 422 || response?.status === 401
        ? ui.login.invalidCredentials
        : response?.status === 429
          ? ui.login.throttled
          : response?.status === 503
            ? ui.login.backendUnavailable
            : ui.login.genericError,
    );
  }

  return (
    <form method="post" onSubmit={onSubmit}>
      <fieldset disabled={!hydrated} className="space-y-4">
        {/* Email Field */}
        <div>
          <label className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-ink-muted">
            <span>{ui.login.email}</span>
            <span className="text-[11px] font-normal lowercase text-ink-muted/70">Wajib diisi</span>
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-muted">
              <Mail className="size-4" aria-hidden="true" />
            </div>
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSelectedRole(null);
              }}
              placeholder="nama@radarisu.mil.id"
              className="h-10 w-full rounded-xl border border-line bg-paper pl-10 pr-3.5 text-sm text-ink placeholder:text-ink-muted/60 transition-colors focus:border-brand focus:bg-panel focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <label className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-ink-muted">
            <span>{ui.login.password}</span>
            <span className="text-[11px] font-normal lowercase text-ink-muted/70">Kata sandi aman</span>
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-muted">
              <Lock className="size-4" aria-hidden="true" />
            </div>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="h-10 w-full rounded-xl border border-line bg-paper pl-10 pr-3.5 text-sm text-ink placeholder:text-ink-muted/60 transition-colors focus:border-brand focus:bg-panel focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-sev-high/20 bg-sev-high-bg p-3 text-xs font-medium text-sev-high"
          >
            <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={pending}
          className="relative inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-md shadow-blue-500/25 transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg hover:shadow-blue-500/35 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <span className="flex items-center gap-2">
              <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>{ui.login.submitting}</span>
            </span>
          ) : (
            <>
              <span>{ui.login.submit}</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          )}
        </button>

        {/* Demo Credentials Helper */}
        <div className="rounded-xl border border-line bg-paper/70 p-3.5">
          <div className="flex items-center justify-between text-caption">
            <span className="flex items-center gap-1.5 font-semibold text-brand">
              <ShieldCheck className="size-4" aria-hidden="true" />
              <span>1-Click Masuk Demo</span>
            </span>
            <span className="text-[11px] text-ink-muted">Pilih peran:</span>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((acc) => {
              const active = selectedRole === acc.role;
              return (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemo(acc.email, acc.role)}
                  className={`flex flex-col items-center justify-center rounded-xl border p-2 text-center transition-all ${
                    active
                      ? "border-brand bg-brand-tint text-brand shadow-sm"
                      : "border-line bg-panel text-ink hover:border-brand/40 hover:bg-hover"
                  }`}
                >
                  <span className="flex items-center gap-1 text-xs font-bold">
                    <UserCheck className="size-3" aria-hidden="true" />
                    <span>{acc.role}</span>
                  </span>
                  <span className="mt-0.5 text-[10px] text-ink-muted">{acc.tag}</span>
                </button>
              );
            })}
          </div>
        </div>
      </fieldset>
    </form>
  );
}
