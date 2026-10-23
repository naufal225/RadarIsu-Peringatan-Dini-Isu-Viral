"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { ui } from "@/lib/labels";

const noopSubscribe = () => () => {};

/** false while rendering on the server and until React has hydrated this component in the browser. */
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function LoginForm() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    setPending(false);
    setError(
      response?.status === 422
        ? ui.login.invalidCredentials
        : response?.status === 429
          ? ui.login.throttled
          : ui.login.genericError,
    );
  }

  // Without JavaScript (chunks failed to load, e.g. a stale build) the browser would submit this form
  // itself. `method="post"` keeps the credentials out of the URL, and the disabled fieldset stops
  // anything from being submitted until onSubmit is attached.
  return (
    <form method="post" onSubmit={onSubmit}>
      <fieldset disabled={!hydrated} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{ui.login.email}</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            className="w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{ui.login.password}</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? ui.login.submitting : ui.login.submit}
        </button>
      </fieldset>
    </form>
  );
}
