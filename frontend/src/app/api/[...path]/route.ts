import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { BackendUnavailableError, backendUnavailableResponse, laravelFetch } from "@/lib/server-api";
import { TOKEN_COOKIE } from "@/lib/session";

// BFF proxy (PRD §7, §12.1): /api/* → ${LARAVEL_URL}/api/v1/* with the bearer token from the httpOnly cookie.
// Status and body are passed through unchanged; authorization is decided by Laravel.

const FORWARDED_RESPONSE_HEADERS = ["content-type", "content-disposition", "retry-after"];

async function forward(request: NextRequest, ctx: RouteContext<"/api/[...path]">): Promise<Response> {
  const { path } = await ctx.params;

  if (path.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return Response.json({ message: "Not found." }, { status: 404 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await laravelFetch(
      path.map(encodeURIComponent).join("/") + request.nextUrl.search,
      token,
      { method: request.method, headers, body: hasBody ? await request.arrayBuffer() : undefined },
    );
  } catch (error) {
    if (error instanceof BackendUnavailableError) return backendUnavailableResponse();
    throw error;
  }

  if (upstream.status === 401) cookieStore.delete(TOKEN_COOKIE);

  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
