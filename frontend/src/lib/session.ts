// Shared by Route Handlers and the proxy. The token never reaches browser JavaScript (PRD §7).

export const TOKEN_COOKIE = "rd_token";

/** 8 hours, matching sanctum.expiration = 480. */
export const TOKEN_MAX_AGE_SECONDS = 8 * 60 * 60;

export const tokenCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: TOKEN_MAX_AGE_SECONDS,
};
