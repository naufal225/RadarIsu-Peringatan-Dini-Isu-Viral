// Detects that `next build` replaced .next underneath a running `next start` server.
//
// The server keeps serving the manifest it loaded at startup, but the chunk files it points at are
// gone: the HTML references them, they answer 500, the page never hydrates and (before the login form
// was hardened) browsers fell back to submitting forms themselves. Failing loudly beats limping on.

import { readFileSync } from "node:fs";

/** Contents of the BUILD_ID file, or null while it is missing (a build in progress removes .next). */
export function readBuildId(file) {
  try {
    return readFileSync(file, "utf8").trim() || null;
  } catch {
    return null;
  }
}

/**
 * Calls `onChange(previous, current)` once when BUILD_ID changes after this call. Does nothing when
 * there is no build to compare with. Returns a function that stops watching.
 */
export function watchBuildId({ file, intervalMs = 5000, onChange }) {
  const startedWith = readBuildId(file);
  if (!startedWith) return () => {};

  const timer = setInterval(() => {
    const current = readBuildId(file);
    if (current && current !== startedWith) {
      clearInterval(timer);
      onChange(startedWith, current);
    }
  }, intervalMs);
  timer.unref();

  return () => clearInterval(timer);
}
