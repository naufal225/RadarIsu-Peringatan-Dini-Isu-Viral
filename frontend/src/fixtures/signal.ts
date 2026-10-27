// Fixture SignalChart untuk /dev/styleguide dan tes. Deterministik: tidak memakai jam browser atau acak.

import type { SignalMarker, SignalPoint, SignalWindow } from "@/lib/signal-chart";

const START = Date.UTC(2026, 9, 25, 0); // 25 Okt 2026 00:00 UTC

/** 48 jam volume: tenang (sekitar 20 per jam), lalu lonjakan pada jam ke-38 sampai ke-42. */
export const SIGNAL_SERIES: SignalPoint[] = Array.from({ length: 48 }, (_, hour) => {
  const wave = Math.round(6 * Math.sin(hour / 3.2));
  const spike = hour >= 38 && hour <= 42 ? [40, 95, 140, 80, 45][hour - 38] : 0;
  return { hour: new Date(START + hour * 3_600_000).toISOString(), volume: 20 + wave + spike };
});

export const SIGNAL_WINDOW: SignalWindow = { start: SIGNAL_SERIES[39].hour, end: SIGNAL_SERIES[41].hour };

export const SIGNAL_MARKERS: SignalMarker[] = [
  { at: SIGNAL_SERIES[40].hour, severity: "high", label: "Lonjakan topik layanan publik" },
  { at: SIGNAL_SERIES[41].hour, severity: "medium", label: "Akun serentak, narasi sama" },
  { at: "2026-10-20T00:00:00Z", severity: "low", label: "Di luar rentang" },
];

/** Nilai dari server (di sini contoh tetap); klien tidak pernah menghitungnya. */
export const SIGNAL_BASELINE = { mean: 20, std: 4.2 };
export const SIGNAL_THRESHOLD = 37;
