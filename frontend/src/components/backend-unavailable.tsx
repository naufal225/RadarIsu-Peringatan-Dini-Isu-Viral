import { ServerCrash } from "lucide-react";
import { ui } from "@/lib/labels";

/** Shown instead of a bare 500 when the BFF cannot reach Laravel (GET /auth/me failed to connect). */
export function BackendUnavailable() {
  return (
    <main className="flex flex-1 items-center justify-center bg-paper px-4 py-10">
      <section role="alert" className="flex max-w-md flex-col items-center gap-2 rounded-control border border-line bg-panel px-6 py-10 text-center">
        <ServerCrash aria-hidden="true" className="size-6 text-sev-high" />
        <h1 className="text-section font-semibold text-ink">{ui.backendUnavailable.title}</h1>
        <p className="text-sm text-ink-muted">{ui.backendUnavailable.body}</p>
        {/* A plain link reloads the whole page, so the server checks the backend again. */}
        <a href="" className="mt-2 inline-flex h-9 items-center rounded-control border border-line-input bg-panel px-3 text-sm font-medium text-ink hover:bg-hover">
          {ui.backendUnavailable.retry}
        </a>
      </section>
    </main>
  );
}
