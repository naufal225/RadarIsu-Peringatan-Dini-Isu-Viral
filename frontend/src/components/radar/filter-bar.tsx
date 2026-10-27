import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/labels";
import { Button } from "./button";
import { controlClass } from "./form";

/** Bilah filter di atas tabel: kontrol sejajar, membungkus di layar sempit. */
export function FilterBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="mb-4 flex flex-wrap items-start gap-3">
      {children}
    </div>
  );
}

/** Kontrol filter berlabel (pilihan atau isian), memakai gaya kontrol bersama. */
export function FilterField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1 text-table text-ink-muted", className)}>
      {label}
      {children}
    </label>
  );
}

export type FilterOption = { value: string; label: string };

/** Pilihan tunggal dengan opsi "Semua" (nilai kosong). */
export function FilterSelect({
  label,
  name,
  value,
  options,
  onChange,
  allLabel = ui.filters.all,
}: {
  label: string;
  /** Form field name (helps autofill and browser tooling). */
  name?: string;
  value: string;
  options: readonly FilterOption[];
  onChange: (value: string) => void;
  allLabel?: string;
}) {
  return (
    <FilterField label={label}>
      <select name={name} value={value} onChange={(event) => onChange(event.target.value)} className={controlClass}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FilterField>
  );
}

/** Tombol "Bersihkan filter"; tidak tampil bila tidak ada filter aktif. */
export function ClearFilters({ active, onClear }: { active: boolean; onClear: () => void }) {
  if (!active) return null;
  // pt-6 = tinggi label filter + jarak, supaya tombol sejajar dengan kontrol walau ada pesan galat di bawahnya.
  return (
    <div className="pt-6">
      <Button onClick={onClear}>
        <X aria-hidden="true" className="size-4" />
        {ui.filters.clear}
      </Button>
    </div>
  );
}

export { controlClass };
