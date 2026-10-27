import { Lock } from "lucide-react";
import { ui } from "@/lib/labels";

export function Forbidden() {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-control border border-line bg-panel px-6 py-10 text-center">
      <Lock aria-hidden="true" className="size-6 text-sev-high" />
      <p className="text-table font-semibold text-sev-high">403</p>
      <h1 className="text-section font-semibold text-ink">{ui.forbidden.title}</h1>
      <p className="text-sm text-ink-muted">{ui.forbidden.body}</p>
    </section>
  );
}
