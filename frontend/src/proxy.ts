import { NextResponse, type NextRequest } from "next/server";
import { TOKEN_COOKIE } from "@/lib/session";

// PRD §12.1: no rd_token cookie → /login. Only a convenience redirect; Laravel validates the token.
export function proxy(request: NextRequest) {
  if (!request.cookies.has(TOKEN_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico).*)"],
};
