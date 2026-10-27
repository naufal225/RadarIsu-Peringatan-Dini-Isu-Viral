"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { ui } from "@/lib/labels";

/**
 * Dialog isi bebas (form, hasil) dengan elemen <dialog> bawaan: fokus terkurung, Escape menutup,
 * fokus kembali ke pemicu. Untuk konfirmasi ya/tidak pakai ConfirmDialog.
 */
export function Dialog({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto w-full max-w-lg rounded-control border border-line bg-panel p-0 text-ink backdrop:bg-ink/40"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 id={titleId} className="text-section font-semibold">
          {title}
        </h2>
        <button type="button" onClick={onClose} aria-label={ui.confirm.cancel} className="rounded-control p-1 text-ink-muted hover:bg-hover">
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="max-h-128 overflow-y-auto p-5">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-line p-4">{footer}</div>}
    </dialog>
  );
}
