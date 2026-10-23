// Minimal shared building blocks for the Phase 2 admin pages. Visual polish is Phase 8.

import type { ReactNode } from "react";
import { ui } from "@/lib/labels";

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="mb-4 text-xl font-semibold">{children}</h1>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-neutral-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-neutral-50 text-neutral-600">
          <tr>
            {head.map((cell, i) => (
              <th key={i} className="px-3 py-2 font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">{children}</tbody>
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
      ? "bg-neutral-900 text-white hover:bg-neutral-700"
      : "border border-neutral-300 hover:bg-neutral-100";
  return (
    <button {...props} className={`rounded-md px-3 py-1.5 text-sm disabled:opacity-50 ${style} ${props.className ?? ""}`}>
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
    </label>
  );
}

export const inputClass = "w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm";

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-red-600">
      {children}
    </p>
  );
}

export function FieldErrors({ fields }: { fields: string[] }) {
  if (fields.length === 0) return null;
  return (
    <p role="alert" className="text-sm text-red-600">
      {ui.common.invalidFields} {fields.join(", ")}
    </p>
  );
}

export function StatusBadge({ tone, children }: { tone: "ok" | "error" | "warn" | "muted"; children: ReactNode }) {
  const style = {
    ok: "bg-green-100 text-green-800",
    error: "bg-red-100 text-red-800",
    warn: "bg-amber-100 text-amber-900",
    muted: "bg-neutral-100 text-neutral-700",
  }[tone];
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${style}`}>{children}</span>;
}
