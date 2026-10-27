// Kontrak tipe bersama (docs/UI_DESIGN_SYSTEM.md §9).

export type Severity = "low" | "medium" | "high";
export type AlertStatus = "new" | "reviewing" | "escalated" | "returned" | "approved" | "false_positive" | "closed";
export type AlertKind = "issue" | "impersonation";
export type AlertAction = "take" | "escalate" | "false_positive" | "close" | "approve" | "return" | "comment";
