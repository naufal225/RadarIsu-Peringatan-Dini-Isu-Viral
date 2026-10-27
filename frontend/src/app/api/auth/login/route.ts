import { cookies } from "next/headers";
import { BackendUnavailableError, backendUnavailableResponse, laravelFetch } from "@/lib/server-api";
import { TOKEN_COOKIE, tokenCookieOptions } from "@/lib/session";

// POST /api/auth/login: exchanges credentials for a Sanctum token and stores it in the httpOnly rd_token cookie.
export async function POST(request: Request): Promise<Response> {
  let upstream: Response;
  try {
    upstream = await laravelFetch("auth/login", undefined, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
    });
  } catch (error) {
    if (error instanceof BackendUnavailableError) return backendUnavailableResponse();
    throw error;
  }

  const body = await upstream.json().catch(() => null);

  if (!upstream.ok) {
    return Response.json(body, { status: upstream.status });
  }

  (await cookies()).set(TOKEN_COOKIE, body.data.token, tokenCookieOptions);

  // The token stays server-side; the browser only gets the user.
  return Response.json({ data: { user: body.data.user } });
}
