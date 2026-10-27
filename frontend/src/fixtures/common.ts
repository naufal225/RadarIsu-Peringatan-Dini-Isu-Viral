// Fixture bersama untuk /dev/styleguide dan tes. Tidak boleh dipakai halaman asli (Design System §2 #11).

import type { AlertStatus, Severity } from "@/components/radar/types";

export type SampleRow = {
  id: number;
  title: string;
  severity: Severity;
  status: AlertStatus;
  score: number;
  detectedAt: string;
  simulated: boolean;
};

export const SAMPLE_ROWS: SampleRow[] = [
  { id: 101, title: "Lonjakan topik layanan publik", severity: "high", status: "new", score: 82, detectedAt: "2026-10-27T07:29:00Z", simulated: true },
  { id: 102, title: "Akun serentak mengutip narasi yang sama", severity: "medium", status: "reviewing", score: 63, detectedAt: "2026-10-27T05:10:00Z", simulated: true },
  { id: 103, title: "Nama tampilan mirip akun resmi", severity: "low", status: "closed", score: 31, detectedAt: "2026-10-26T17:30:00Z", simulated: false },
  { id: 104, title: "Peningkatan volume topik anggaran", severity: "medium", status: "escalated", score: 58, detectedAt: "2026-10-26T11:02:00Z", simulated: false },
];

export const ALL_STATUSES: AlertStatus[] = ["new", "reviewing", "escalated", "returned", "approved", "false_positive", "closed"];
export const ALL_SEVERITIES: Severity[] = ["low", "medium", "high"];

/** Nilai waktu tetap supaya tampilan styleguide tidak berubah antar pemuatan (tanpa jam browser). */
export const SAMPLE_TIME = "2026-10-27T07:29:00Z";
