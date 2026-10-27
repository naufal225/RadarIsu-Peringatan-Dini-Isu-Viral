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

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /** Shows a spinner and disables the button. */
  pending?: boolean;
};

/** Tombol fondasi. Tanpa bayangan; disabled = opasitas 50% (Design System §11). */
export function Button({ variant = "secondary", pending = false, disabled, className, children, type = "button", ...props }: ButtonProps) {
  const inactive = disabled || pending;
  return (
    <button
      {...props}
      type={type}
      disabled={inactive}
      aria-disabled={inactive || undefined}
      aria-busy={pending || undefined}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-control px-3 text-sm font-medium transition-colors duration-150",
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
