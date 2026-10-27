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

  try {
    return await fetch(laravelUrl(path), { ...init, headers, cache: "no-store" });
  } catch (cause) {
    // Laravel is down or unreachable (ECONNREFUSED, DNS, timeout). Callers turn this into a 503, not a bare 500.
    console.error(`[bff] Laravel unreachable at ${laravelUrl(path)}`, cause);
    throw new BackendUnavailableError(cause);
  }
}

/** Laravel could not be reached at all (as opposed to answering with an error status). */
export class BackendUnavailableError extends Error {
  constructor(cause: unknown) {
    super("backend_unavailable", { cause });
    this.name = "BackendUnavailableError";
  }
}

/** JSON body for a 503 when Laravel is unreachable; the frontend maps the code to a message. */
export function backendUnavailableResponse(): Response {
  return Response.json({ message: "backend_unavailable", errors: { server: ["backend_unavailable"] } }, { status: 503 });
}

export type MeResult = { status: "ok"; me: Me } | { status: "unauthenticated" } | { status: "unavailable" };

/** GET /auth/me for the current request, deduplicated across layout and pages. */
export const getMe = cache(async (): Promise<MeResult> => {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return { status: "unauthenticated" };

  let response: Response;
  try {
    response = await laravelFetch("auth/me", token);
  } catch (error) {
    if (error instanceof BackendUnavailableError) return { status: "unavailable" };
    throw error;
  }
  if (response.status === 401) return { status: "unauthenticated" };
  if (!response.ok) throw new Error(`auth/me failed with ${response.status}`);

  const body = (await response.json()) as { data: Me };
  return { status: "ok", me: body.data };
});
