import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";

/** Gaya input/select/textarea bersama: batas --line-input (kontras >= 3:1), cincin fokus dari globals.css. */
export const controlClass =
  "h-9 w-full rounded-control border border-line-input bg-panel px-3 text-sm text-ink placeholder:text-ink-muted disabled:cursor-not-allowed disabled:opacity-50";

/** Input berkas: tombol pemilih bergaya kontrol sekunder. */
export const fileInputClass =
  "block w-full text-sm text-ink file:mr-3 file:h-9 file:cursor-pointer file:rounded-control file:border file:border-line-input file:bg-panel file:px-3 file:text-sm file:font-medium file:text-ink hover:file:bg-hover";

/** Kotak centang bawaan dengan warna merek (accent-color), ukuran 16 px. */
export const checkboxClass = "size-4 shrink-0 cursor-pointer accent-brand";

/** Bidang berlabel dengan pesan galat 422 di bawahnya (ikon + teks, bukan toast). */
export function Field({ label, error, hint, children }: { label: string; error?: string | null; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-ink">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-caption text-ink-muted">{hint}</span>}
      {error && <FieldError>{error}</FieldError>}
    </label>
  );
}

export function FieldError({ children }: { children: ReactNode }) {
  return (
    <span role="alert" className="mt-1 flex items-center gap-1.5 text-table text-sev-high">
      <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
      {children}
    </span>
  );
}
