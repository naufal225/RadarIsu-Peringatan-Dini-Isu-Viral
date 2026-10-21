import { cookies } from "next/headers";
import { laravelFetch } from "@/lib/server-api";
import { TOKEN_COOKIE } from "@/lib/session";

// POST /api/auth/logout: revokes the Sanctum token, then clears the cookie regardless of the upstream result.
export async function POST(): Promise<Response> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;

  if (token) {
    await laravelFetch("auth/logout", token, { method: "POST" }).catch(() => null);
  }

  cookieStore.delete(TOKEN_COOKIE);

  return Response.json({ data: null });
}
