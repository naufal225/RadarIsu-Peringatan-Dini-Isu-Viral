import "server-only";

import { cookies, headers as requestHeaders } from "next/headers";
import { cache } from "react";
import type { Me } from "./permissions";
import { TOKEN_COOKIE } from "./session";

export function laravelUrl(path: string): string {
  const base = process.env.LARAVEL_URL ?? "http://127.0.0.1:8000";
  return `${base.replace(/\/$/, "")}/api/v1/${path.replace(/^\//, "")}`;
}

export async function laravelFetch(path: string, token: string | undefined, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  // server.mjs has already replaced X-Forwarded-For with the socket peer address; always overwrite
  // (never append) so nothing client-supplied reaches Laravel.
  const clientIp = (await requestHeaders()).get("x-forwarded-for");
  headers.delete("x-forwarded-for");
  if (clientIp) headers.set("X-Forwarded-For", clientIp);

  return fetch(laravelUrl(path), { ...init, headers, cache: "no-store" });
}

export type MeResult = { status: "ok"; me: Me } | { status: "unauthenticated" };

/** GET /auth/me for the current request, deduplicated across layout and pages. */
export const getMe = cache(async (): Promise<MeResult> => {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return { status: "unauthenticated" };

  const response = await laravelFetch("auth/me", token);
  if (response.status === 401) return { status: "unauthenticated" };
  if (!response.ok) throw new Error(`auth/me failed with ${response.status}`);

  const body = (await response.json()) as { data: Me };
  return { status: "ok", me: body.data };
});
