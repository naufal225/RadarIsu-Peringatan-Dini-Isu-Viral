// Browser-side API client. All calls go through the same-origin BFF at /api/* (PRD §12.1).

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { message?: string; errors?: Record<string, string[]> } | null,
  ) {
    super(body?.message ?? `Request failed with ${status}`);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  const response = await fetch(`/api/${path.replace(/^\//, "")}`, { ...init, headers });

  if (response.status === 401) {
    // The BFF already cleared the cookie. A full navigation (not router.push) is intentional:
    // this is not a component, and dropping all client state after losing the session is desired.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
    throw new ApiError(401, null);
  }

  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, body);

  return body as T;
}
