// GET/PUT /settings/detection dan /settings/offline-mode (PRD §11, F15). Bentuk dari SettingController
// (docs/CONTRACTS.md §3.4–3.5). Tipe nilai dan aturan validasi ada di lib/detection-settings.ts.

export type { DetectionSettings, OfflineModeResponse, SettingsResponse, Sensitivity, WeightKey } from "@/lib/detection-settings";
