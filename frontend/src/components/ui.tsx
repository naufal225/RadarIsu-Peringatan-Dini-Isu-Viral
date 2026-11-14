// Lapisan lama untuk halaman admin dan halaman yang belum bermigrasi ke components/radar/.
// Seluruh warna memakai token (globals.css). Tidak ada hijau: status "ok" netral dengan teks.

import type { ReactNode } from "react";
import { ui } from "@/lib/labels";

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="mb-4 text-xl font-semibold text-ink">{children}</h1>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-base font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-control border border-line bg-panel">
      <table className="w-full text-left text-sm">
        <thead className="bg-hover text-ink-muted">
          <tr>
            {head.map((cell, i) => (
              <th key={i} className="px-3 py-2 font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line text-ink">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

export function Button({
  children,
  variant = "secondary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  const style =
    variant === "primary"
      ? "bg-brand text-brand-fg hover:opacity-90"
      : "border border-line-input bg-panel text-ink hover:bg-hover";
  return (
    <button
      {...props}
      className={`rounded-control px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${style} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-control border border-line-input bg-paper px-3 py-1.5 text-sm text-ink placeholder:text-ink-muted";

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-sev-high">
      {children}
    </p>
  );
}

export function FieldErrors({ fields }: { fields: string[] }) {
  if (fields.length === 0) return null;
  return (
    <p role="alert" className="text-sm text-sev-high">
      {ui.common.invalidFields} {fields.join(", ")}
    </p>
  );
}

export function StatusBadge({ tone, children }: { tone: "ok" | "error" | "warn" | "muted"; children: ReactNode }) {
  const style = {
    ok: "border border-line-input bg-hover text-ink",
    error: "bg-sev-high-bg text-sev-high",
    warn: "bg-sev-medium-bg text-sev-medium",
    muted: "bg-hover text-ink-muted",
  }[tone];
  return <span className={`rounded-badge px-2 py-0.5 text-xs font-medium ${style}`}>{children}</span>;
}
