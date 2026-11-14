// Grafik volume Replay yang tumbuh mengikuti jam data (PRD §10.10). Murni: tanpa fetch, tanpa teks UI.
// Sumber: metrik per jam dari GET /topics/{id}/metrics, digabung untuk semua topik aktif.

import type { SignalPoint } from "@/lib/signal-chart";
import type { HourlyMetric } from "@/lib/topics";

const HOUR_MS = 60 * 60 * 1000;

function floorHour(time: number): number {
  return Math.floor(time / HOUR_MS) * HOUR_MS;
}

/** Tanggal UTC (YYYY-MM-DD) untuk parameter `from`/`to` metrik. */
export function utcDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Deret volume per jam dari awal jam jangkar sampai jam data sekarang (inklusif).
 * Volume dijumlahkan dari semua topik. Jam tanpa baris metrik dihitung 0, sesuai aturan metrik.
 * Jam setelah `clockNow` tidak ikut: grafik hanya memuat yang sudah berlalu di jam data.
 */
export function replayTrend(metricsByTopic: HourlyMetric[][], anchor: Date, clockNow: Date): SignalPoint[] {
  const start = floorHour(anchor.getTime());
  const end = floorHour(clockNow.getTime());
  if (end < start) return [];

  const totals = new Map<number, number>();
  for (let t = start; t <= end; t += HOUR_MS) totals.set(t, 0);

  for (const rows of metricsByTopic) {
    for (const row of rows) {
      const hour = floorHour(new Date(row.hour).getTime());
      if (totals.has(hour)) totals.set(hour, (totals.get(hour) ?? 0) + row.volume);
    }
  }

  return [...totals.entries()].map(([time, volume]) => ({ hour: new Date(time).toISOString(), volume }));
}

/**
 * Jendela insiden di jam data: dari awal insiden (jangkar + offset) sampai jam data sekarang.
 * Null bila jangkar, offset, atau jam sekarang tidak ada, atau insiden belum dimulai.
 */
export function incidentWindow(
  anchorIso: string | null,
  offsetSeconds: number | null,
  clockNowIso: string | null,
): { start: string; end: string } | null {
  if (!anchorIso || offsetSeconds === null || !clockNowIso) return null;
  const start = new Date(new Date(anchorIso).getTime() + offsetSeconds * 1000).getTime();
  const end = new Date(clockNowIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}
