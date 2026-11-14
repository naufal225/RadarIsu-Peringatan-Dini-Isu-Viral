// Aksi yang boleh ditampilkan untuk satu alert, dari izin dan status saat ini.
// Cerminan PRD §8.5 dan UI_DESIGN_SYSTEM §9. Ini hanya untuk menyembunyikan tombol:
// server tetap penentu (403/422).

export type AlertActionKey = "take" | "escalate" | "false-positive" | "close" | "approve" | "return" | "comment";

export function availableActions(granted: readonly string[], status: string): AlertActionKey[] {
  const has = (permission: string) => granted.includes(permission);
  const actions: AlertActionKey[] = [];

  if (has("alerts.triage")) {
    if (status === "new") actions.push("take");
    if (status === "reviewing" || status === "returned") {
      actions.push("escalate", "false-positive", "close");
    }
  }

  if (has("alerts.decide") && status === "escalated") {
    actions.push("approve", "return");
  }

  if (has("alerts.view")) {
    actions.push("comment");
  }

  return actions;
}
