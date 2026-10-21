"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ui } from "@/lib/labels";

export function LoginForm() {
  const router = useRouter();
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

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
    </form>
  );
}
