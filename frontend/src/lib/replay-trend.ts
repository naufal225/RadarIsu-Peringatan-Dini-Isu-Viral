// Grafik jumlah posting per menit data selama Replay (PRD §10.10). Murni: tanpa fetch, tanpa teks UI.
// Sumber: GET /replay/scenarios/{id}/series?until=, yaitu posting run terakhir per menit posted_at.

export type MinuteCount = { t: string; count: number };

const MINUTE_MS = 60 * 1000;

function floorMinute(time: number): number {
  return Math.floor(time / MINUTE_MS) * MINUTE_MS;
}

/**
 * Deret per menit dari menit posting pertama sampai menit jam data sekarang (inklusif).
 * Menit tanpa posting dihitung 0. Posting setelah `clockNow` tidak ikut, supaya grafik tidak mendahului jam data.
 */
export function minuteTrend(points: MinuteCount[], clockNow: Date): MinuteCount[] {
  const end = floorMinute(clockNow.getTime());
  const counts = new Map<number, number>();
  for (const point of points) {
    const at = floorMinute(new Date(point.t).getTime());
    if (at <= end) counts.set(at, (counts.get(at) ?? 0) + point.count);
  }
  if (counts.size === 0) return [];

  const start = Math.min(...counts.keys());
  const series: MinuteCount[] = [];
  for (let at = start; at <= end; at += MINUTE_MS) {
    series.push({ t: new Date(at).toISOString(), count: counts.get(at) ?? 0 });
  }
  return series;
}
