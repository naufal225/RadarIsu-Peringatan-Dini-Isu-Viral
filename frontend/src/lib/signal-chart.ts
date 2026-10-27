// Pengolahan seri untuk SignalChart (docs/UI_DESIGN_SYSTEM.md §9). Logika murni, tanpa React.
// Aturan jujur: ambang deteksi TIDAK dihitung di klien. `baseline` dan `threshold` hanya digambar bila
// server mengirimkannya; selain itu hanya "rata-rata rentang ini" yang dihitung dari seri yang tampil.

import type { Severity } from "@/components/radar/types";
import { formatUtc, formatWib, parseTime } from "@/lib/format/time";

export type SignalPoint = { hour: string; volume: number };
export type SignalBaseline = { mean: number; std: number };
export type SignalWindow = { start: string; end: string };
export type SignalMarker = { at: string; severity: Severity; label: string };

export type ChartPoint = { t: number; hour: string; volume: number };
export type ChartMarker = { t: number; volume: number; severity: Severity; label: string; at: string };
export type ChartWindow = { from: number; to: number };

/** Which horizontal reference line is drawn and why. `range` is NOT the detection baseline. */
export type ReferenceKind = "baseline" | "range";

const HOUR_MS = 3_600_000;

/** Valid points only (parsable hour, finite non-negative volume), oldest first; a repeated hour keeps the last value. */
export function normalizeSeries(series: readonly SignalPoint[]): ChartPoint[] {
  const byTime = new Map<number, ChartPoint>();
  for (const point of series) {
    const date = parseTime(point.hour);
    if (!date || !Number.isFinite(point.volume) || point.volume < 0) continue;
    byTime.set(date.getTime(), { t: date.getTime(), hour: date.toISOString(), volume: point.volume });
  }
  return [...byTime.values()].sort((a, b) => a.t - b.t);
}

/** Mean volume of the points shown; null for an empty series. Never a detection value. */
export function rangeMean(points: readonly ChartPoint[]): number | null {
  if (points.length === 0) return null;
  return points.reduce((sum, p) => sum + p.volume, 0) / points.length;
}

/** The highest point, or null when empty. The earliest wins a tie. */
export function peakPoint(points: readonly ChartPoint[]): ChartPoint | null {
  let peak: ChartPoint | null = null;
  for (const p of points) if (!peak || p.volume > peak.volume) peak = p;
  return peak;
}

/**
 * Pins sit on the point of their hour (the nearest point within half an hour). Markers outside the shown
 * range are dropped and counted, so the caller can say so instead of silently losing them.
 */
export function placeMarkers(points: readonly ChartPoint[], markers: readonly SignalMarker[]): { placed: ChartMarker[]; dropped: number } {
  const placed: ChartMarker[] = [];
  let dropped = 0;
  for (const marker of markers) {
    const at = parseTime(marker.at);
    const nearest = at ? nearestPoint(points, at.getTime()) : null;
    if (!at || !nearest || Math.abs(nearest.t - at.getTime()) > HOUR_MS / 2) {
      dropped++;
      continue;
    }
    placed.push({ t: nearest.t, volume: nearest.volume, severity: marker.severity, label: marker.label, at: at.toISOString() });
  }
  return { placed, dropped };
}

function nearestPoint(points: readonly ChartPoint[], t: number): ChartPoint | null {
  let best: ChartPoint | null = null;
  for (const p of points) if (!best || Math.abs(p.t - t) < Math.abs(best.t - t)) best = p;
  return best;
}

/** The highlighted window clipped to the shown range; null when invalid, reversed, or fully outside. */
export function clipWindow(points: readonly ChartPoint[], window: SignalWindow | undefined): ChartWindow | null {
  if (!window || points.length === 0) return null;
  const start = parseTime(window.start)?.getTime();
  const end = parseTime(window.end)?.getTime();
  if (start === undefined || end === undefined || end < start) return null;
  const min = points[0].t;
  const max = points[points.length - 1].t;
  if (end < min || start > max) return null;
  return { from: Math.max(start, min), to: Math.min(end, max) };
}

/** Evenly spaced tick times on whole hours, at most `maxTicks`, always including the first point. */
export function tickTimes(points: readonly ChartPoint[], maxTicks: number): number[] {
  if (points.length === 0 || maxTicks < 1) return [];
  const step = Math.max(1, Math.ceil(points.length / maxTicks));
  return points.filter((_, index) => index % step === 0).map((p) => p.t);
}

/** "14.00" in WIB; with the date ("27 Okt 14.00") for the first tick and when the day changes. */
export function hourLabel(t: number, previousT: number | null): string {
  const time = formatWib(new Date(t), "time").replace(" WIB", "");
  const day = (value: number) => formatWib(new Date(value), "date");
  if (previousT === null || day(t) !== day(previousT)) {
    const [d, m] = day(t).split(" ");
    return `${d} ${m} ${time}`;
  }
  return time;
}

/** Tooltip heading: "14.00 WIB (07.00 UTC)". */
export function tooltipTime(t: number): string {
  return `${formatWib(new Date(t), "time")} (${formatUtc(new Date(t), "time")})`;
}

export type SeriesSummary = { count: number; peak: ChartPoint | null; mean: number | null };

export function summarize(points: readonly ChartPoint[]): SeriesSummary {
  return { count: points.length, peak: peakPoint(points), mean: rangeMean(points) };
}
