import type { ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-fg border border-brand hover:bg-viz-1",
  secondary: "bg-panel text-ink border border-line-input hover:bg-hover",
  destructive: "bg-sev-high text-brand-fg border border-sev-high hover:bg-ink",
  ghost: "bg-transparent text-ink border border-transparent hover:bg-hover",
};

export type ButtonSize = "sm" | "md";

const SIZES: Record<ButtonSize, string> = {
  md: "h-9 gap-2 px-3 text-sm",
  // Aksi per baris tabel: lebih ringkas agar beberapa aksi muat satu baris.
  sm: "h-8 gap-1.5 px-2.5 text-table",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables the button. */
  pending?: boolean;
};

/** Tombol fondasi. Tanpa bayangan; disabled = opasitas 50% (Design System §11). */
export function Button({ variant = "secondary", size = "md", pending = false, disabled, className, children, type = "button", ...props }: ButtonProps) {
  const inactive = disabled || pending;
  return (
    <button
      {...props}
      type={type}
      disabled={inactive}
      aria-disabled={inactive || undefined}
      aria-busy={pending || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-control font-medium transition-colors duration-150",
        SIZES[size],
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
    >
      {pending && <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />}
      {children}
    </button>
  );
}
