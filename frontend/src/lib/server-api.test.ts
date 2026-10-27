import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => ({ value: "token" }) }),
}));

import { BackendUnavailableError, backendUnavailableResponse, getMe, laravelFetch } from "./server-api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("BFF when Laravel is unreachable", () => {
  it("throws BackendUnavailableError instead of a raw fetch failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(laravelFetch("auth/login", undefined, { method: "POST" })).rejects.toBeInstanceOf(BackendUnavailableError);
  });

  it("answers 503 with a code the UI can translate", async () => {
    const response = backendUnavailableResponse();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ message: "backend_unavailable", errors: { server: ["backend_unavailable"] } });
  });

  it("reports the session as unavailable rather than crashing the layout", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(getMe()).resolves.toEqual({ status: "unavailable" });
  });

  it("still passes real HTTP answers through", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 422 })));

    expect((await laravelFetch("auth/login", undefined)).status).toBe(422);
  });
});
