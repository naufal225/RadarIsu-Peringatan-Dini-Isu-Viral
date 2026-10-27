"use client";

import { useMemo } from "react";
import { Area, CartesianGrid, ComposedChart, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ErrorState } from "@/components/radar/states";
import { SkeletonChart } from "@/components/radar/skeleton";
import type { Severity } from "@/components/radar/types";
import { cn } from "@/lib/cn";
import { formatInteger, formatNumber } from "@/lib/format";
import { formatUtc, formatWib } from "@/lib/format/time";
import { severityLabels, ui } from "@/lib/labels";
import {
  clipWindow,
  hourLabel,
  normalizeSeries,
  placeMarkers,
  rangeMean,
  summarize,
  tickTimes,
  tooltipTime,
  type ChartMarker,
  type ChartPoint,
  type ReferenceKind,
  type SignalBaseline,
  type SignalMarker,
  type SignalPoint,
  type SignalWindow,
} from "@/lib/signal-chart";

export type { SignalBaseline, SignalMarker, SignalPoint, SignalWindow };

export type SignalChartProps = {
  series: SignalPoint[];
  /** Hanya bila server menyediakan. Tanpa ini yang digambar hanya rata-rata rentang yang tampil. */
  baseline?: SignalBaseline;
  /** Volume ambang dari server. Tidak pernah dihitung di klien. */
  threshold?: number;
  window?: SignalWindow;
  markers?: SignalMarker[];
  variant?: "full" | "compact";
  loading?: boolean;
  error?: { onRetry?: () => void } | null;
};

const PIN_COLOR: Record<Severity, string> = {
  high: "var(--sev-high)",
  medium: "var(--sev-medium)",
  low: "var(--sev-low)",
};

const PIN_CLASS: Record<Severity, string> = {
  high: "bg-sev-high",
  medium: "bg-sev-medium",
  low: "bg-sev-low",
};

type TooltipProps = { active?: boolean; payload?: ReadonlyArray<{ payload: ChartPoint }>; pins: Map<number, ChartMarker[]> };

function ChartTooltip({ active, payload, pins }: TooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-control border border-line bg-panel px-3 py-2 text-table text-ink">
      <p className="font-mono">{tooltipTime(point.t)}</p>
      <p>
        {ui.chart.volumeShort}: <span className="font-semibold tabular-nums">{formatInteger(point.volume)}</span>
      </p>
      {(pins.get(point.t) ?? []).map((pin) => (
        <p key={`${pin.label}-${pin.at}`} className="text-ink-muted">
          {severityLabels[pin.severity]}: {pin.label}
        </p>
      ))}
    </div>
  );
}

/**
 * Grafik volume per jam ("Denyut Isu", Design System §9). Satu-satunya warna jenuh adalah pin alert.
 * Turun-kualitas jujur: tanpa baseline/ambang dari server, hanya garis volume dan rata-rata rentang
 * yang tampil (diberi label bahwa itu bukan baseline deteksi).
 */
export function SignalChart({ series, baseline, threshold, window: highlight, markers = [], variant = "full", loading, error }: SignalChartProps) {
  const points = useMemo(() => normalizeSeries(series), [series]);
  const placement = useMemo(() => placeMarkers(points, markers), [points, markers]);
  const band = useMemo(() => clipWindow(points, highlight), [points, highlight]);
  const summary = useMemo(() => summarize(points), [points]);
  const ticks = useMemo(() => tickTimes(points, 8), [points]);
  const tickText = useMemo(() => {
    const map = new Map<number, string>();
    ticks.forEach((t, index) => map.set(t, hourLabel(t, index === 0 ? null : ticks[index - 1])));
    return map;
  }, [ticks]);

  if (error) return <ErrorState onRetry={error.onRetry} />;
  if (loading) return <SkeletonChart height={variant === "compact" ? "h-16" : "h-72"} />;
  if (points.length === 0) {
    return <p className="rounded-control border border-line bg-panel px-4 py-8 text-center text-sm text-ink-muted">{ui.chart.empty}</p>;
  }

  const compact = variant === "compact";
  const referenceKind: ReferenceKind = baseline ? "baseline" : "range";
  const referenceValue = baseline ? baseline.mean : rangeMean(points);
  const markerByTime = new Map<number, ChartMarker[]>();
  for (const marker of placement.placed) markerByTime.set(marker.t, [...(markerByTime.get(marker.t) ?? []), marker]);

  const description = summary.peak
    ? ui.chart.summary(summary.count, formatInteger(summary.peak.volume), formatWib(summary.peak.hour))
    : ui.chart.summaryNone;

  return (
    <figure className="m-0">
      <div role="img" aria-label={description} className={cn("w-full", compact ? "h-16" : "h-72")}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={compact ? { top: 4, right: 0, bottom: 0, left: 0 } : { top: 12, right: 12, bottom: 4, left: 0 }}>
            {!compact && <CartesianGrid vertical={false} stroke="var(--chart-grid)" />}
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              ticks={ticks}
              tickFormatter={(t: number) => tickText.get(t) ?? ""}
              hide={compact}
              tickLine={false}
              axisLine={{ stroke: "var(--chart-grid)" }}
              tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
            />
            <YAxis
              hide={compact}
              width={44}
              allowDecimals={false}
              domain={[0, "auto"]}
              tickFormatter={(v: number) => formatInteger(v)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
            />
            {band && <ReferenceArea x1={band.from} x2={band.to} fill="var(--brand-tint)" fillOpacity={1} ifOverflow="visible" />}
            <Area
              type="monotone"
              dataKey="volume"
              stroke="var(--chart-volume)"
              strokeWidth={2}
              fill="var(--chart-volume)"
              fillOpacity={0.12}
              dot={false}
              activeDot={{ r: 4, fill: "var(--chart-volume)", stroke: "var(--panel)" }}
              isAnimationActive={false}
            />
            {referenceValue !== null && <ReferenceLine y={referenceValue} stroke="var(--chart-ref)" strokeDasharray="4 4" />}
            {threshold !== undefined && <ReferenceLine y={threshold} stroke="var(--chart-ref)" strokeWidth={2} strokeDasharray="8 4" />}
            {placement.placed.map((pin) => (
              <ReferenceDot key={`${pin.label}-${pin.at}`} x={pin.t} y={pin.volume} r={compact ? 4 : 6} fill={PIN_COLOR[pin.severity]} stroke="var(--panel)" strokeWidth={2} ifOverflow="visible" />
            ))}
            <Tooltip content={(props) => <ChartTooltip {...(props as Omit<TooltipProps, "pins">)} pins={markerByTime} />} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {!compact && (
        <>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-caption text-ink-muted">
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block h-0.5 w-5 bg-brand" />
              {ui.chart.volume}
            </li>
            {referenceValue !== null && (
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block w-5 border-t-2 border-dashed border-ink-muted" />
                {referenceKind === "baseline" ? ui.chart.referenceBaseline : ui.chart.referenceRange}
                <span className="font-mono text-ink">{formatNumber(referenceValue, 0, 1)}</span>
              </li>
            )}
            {threshold !== undefined && (
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block w-5 border-t-2 border-dashed border-ink" />
                {ui.chart.threshold}
                <span className="font-mono text-ink">{formatNumber(threshold, 0, 1)}</span>
              </li>
            )}
            {band && (
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block size-3 rounded-badge border border-line bg-brand-tint" />
                {ui.chart.window}
              </li>
            )}
            {placement.placed.length > 0 && (
              <li className="flex items-center gap-2">
                {(["high", "medium", "low"] as const)
                  .filter((s) => placement.placed.some((p) => p.severity === s))
                  .map((s) => (
                    <span key={s} aria-hidden="true" className={cn("inline-block size-3 rounded-full", PIN_CLASS[s])} />
                  ))}
                {ui.chart.markers}
              </li>
            )}
            {placement.dropped > 0 && <li>{ui.chart.droppedMarkers(placement.dropped)}</li>}
          </ul>

          <details className="mt-3 text-table">
            <summary className="cursor-pointer text-brand underline-offset-2 hover:underline">{ui.chart.viewAsTable}</summary>
            <div className="mt-2 max-h-72 overflow-auto rounded-control border border-line">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">{ui.chart.tableCaption}</caption>
                <thead className="sticky top-0 bg-paper text-ink-muted">
                  <tr>
                    <th scope="col" className="h-8 px-3 font-medium">{ui.chart.columns.wib}</th>
                    <th scope="col" className="px-3 font-medium">{ui.chart.columns.utc}</th>
                    <th scope="col" className="px-3 text-right font-medium">{ui.chart.columns.volume}</th>
                    <th scope="col" className="px-3 font-medium">{ui.chart.columns.marker}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {points.map((p) => (
                    <tr key={p.t} className="h-8">
                      <td className="px-3 font-mono">{formatWib(p.hour)}</td>
                      <td className="px-3 font-mono text-ink-muted">{formatUtc(p.hour, "time")}</td>
                      <td className="px-3 text-right font-mono tabular-nums">{formatInteger(p.volume)}</td>
                      <td className="px-3">{(markerByTime.get(p.t) ?? []).map((m) => `${severityLabels[m.severity]}: ${m.label}`).join("; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </figure>
  );
}
