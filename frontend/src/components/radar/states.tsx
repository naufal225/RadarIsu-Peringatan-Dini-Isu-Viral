"use client";

import type { ReactNode } from "react";
import { Hourglass, Inbox, SearchX, TriangleAlert, type LucideIcon } from "lucide-react";
import { ui } from "@/lib/labels";
import { Button } from "./button";
import { Waktu } from "./waktu";

function Panel({ icon: Icon, title, description, children, tone = "text-ink-muted" }: { icon: LucideIcon; title: string; description?: string; children?: ReactNode; tone?: string }) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-control border border-line bg-panel px-6 py-10 text-center">
      <Icon aria-hidden="true" className={`size-6 ${tone}`} />
      <h2 className="text-section font-semibold text-ink">{title}</h2>
      {description && <p className="text-sm text-ink-muted">{description}</p>}
      {children}
    </section>
  );
}

/** Pernyataan faktual ("Tidak ada isu aktif"). `loadedAt` diberi label "Dimuat pukul …". */
export function EmptyState({ title, description, loadedAt, action }: { title: string; description?: string; loadedAt?: string | Date | null; action?: ReactNode }) {
  return (
    <Panel icon={Inbox} title={title} description={description}>
      {loadedAt && (
        <p className="text-caption text-ink-muted">
          {ui.state.loadedAtLabel}{" "}
          <Waktu value={loadedAt} format="time" className="text-caption" />
        </p>
      )}
      {action}
    </Panel>
  );
}

/** Galat jaringan atau 5xx. Selalu ikon + teks. */
export function ErrorState({ title = ui.state.errorTitle, description = ui.state.errorBody, onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <div role="alert">
      <Panel icon={TriangleAlert} title={title} description={description} tone="text-sev-high">
        {onRetry && (
          <Button onClick={onRetry} className="mt-2">
            {ui.state.retry}
          </Button>
        )}
      </Panel>
    </div>
  );
}

/** Layar 404 netral: tidak membedakan "tidak ada" dari "tidak boleh dilihat" (PRD §8.4). */
export function NotAvailable({ title = ui.state.notAvailableTitle, description = ui.state.notAvailableBody }: { title?: string; description?: string }) {
  return <Panel icon={SearchX} title={title} description={description} />;
}

/** Endpoint yang masih stub 501: bukan galat. */
export function NotImplemented({ title = ui.state.notImplementedTitle, description = ui.state.notImplementedBody }: { title?: string; description?: string }) {
  return <Panel icon={Hourglass} title={title} description={description} />;
}
