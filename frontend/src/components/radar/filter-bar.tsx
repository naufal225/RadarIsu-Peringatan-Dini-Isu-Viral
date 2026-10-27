import type { ReactNode } from "react";
import { controlClass } from "./form";

/** Bilah filter di atas tabel: kontrol sejajar, membungkus di layar sempit. */
export function FilterBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="mb-4 flex flex-wrap items-end gap-3">
      {children}
    </div>
  );
}

/** Kontrol filter berlabel (pilihan atau isian), memakai gaya kontrol bersama. */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-table text-ink-muted">
      {label}
      {children}
    </label>
  );
}

export { controlClass };
