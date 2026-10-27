import { FlaskConical } from "lucide-react";
import { ui } from "@/lib/labels";
import { Waktu } from "./waktu";

/**
 * Strip di atas area konten (Design System §6). `dataClock` adalah jam data bila payload menyediakannya;
 * jangan diisi dari jam browser.
 */
export function SimulationBanner({ dataClock }: { dataClock?: string | Date | null }) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-sim px-4 py-2 text-sm text-brand-fg">
      <FlaskConical aria-hidden="true" className="size-4 shrink-0" />
      <span>
        <strong className="font-semibold">{ui.simulation.bannerTitle}</strong> · {ui.simulation.bannerBody}
      </span>
      {dataClock ? (
        <span className="font-mono text-table">
          {ui.simulation.dataClockLabel}{" "}
          <Waktu value={dataClock} format="time" className="text-table text-brand-fg" />
        </span>
      ) : null}
    </div>
  );
}

/** Lencana kecil per baris, kartu, atau pin yang memuat data `is_simulated`. */
export function SimBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-badge border border-sim bg-sim-bg px-1.5 py-0.5 text-caption font-medium text-sim">
      <FlaskConical aria-hidden="true" className="size-3" />
      {ui.simulation.badge}
    </span>
  );
}
