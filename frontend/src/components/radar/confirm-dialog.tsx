"use client";

import { useEffect, useRef } from "react";
import { ui } from "@/lib/labels";
import { Button } from "./button";

/**
 * Dialog konfirmasi memakai elemen <dialog> bawaan: fokus terkurung di dalam dialog, Escape menutup,
 * dan fokus kembali ke pemicu (Design System §11). Tanpa dependensi UI tambahan.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  pending = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

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
      onCancel={(event) => {
        // Selama permintaan berjalan dialog tidak boleh tertutup oleh Escape.
        if (pending) event.preventDefault();
      }}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-description"
      className="m-auto w-full max-w-md rounded-control border border-line bg-panel p-0 text-ink backdrop:bg-ink/40"
    >
      <div className="space-y-2 p-5">
        <h2 id="confirm-title" className="text-section font-semibold">
          {title}
        </h2>
        <p id="confirm-description" className="text-sm text-ink-muted">
          {description}
        </p>
      </div>
      <div className="flex justify-end gap-2 border-t border-line p-4">
        <Button onClick={onClose} disabled={pending}>
          {ui.confirm.cancel}
        </Button>
        <Button variant={destructive ? "destructive" : "primary"} onClick={onConfirm} pending={pending}>
          {pending ? ui.confirm.pending : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
