"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDateTime } from "@/lib/format";
import { ui } from "@/lib/labels";
import { chartPoints, type SpikePoint, type SpikeSnapshot } from "@/lib/spike";

const copy = ui.detection.spike;

const axisTime = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const COLORS = { full: "#2563eb", running: "#93c5fd", threshold: "#dc2626", mean: "#6b7280" } as const;

/** Posts per hour against the spike threshold. The running hour is partial, so it is drawn lighter. */
export function SpikeChart({ series, spike }: { series: SpikePoint[]; spike: SpikeSnapshot }) {
  const rows = chartPoints(series);

  return (
    <div className="h-72 w-full max-w-5xl text-xs" role="img" aria-label={copy.chartLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="currentColor" strokeOpacity={0.15} vertical={false} />
          <XAxis
            dataKey="hour"
            tickFormatter={(hour: string) => axisTime.format(new Date(hour))}
            minTickGap={48}
            tick={{ fill: "currentColor" }}
            stroke="currentColor"
            strokeOpacity={0.4}
          />
          <YAxis allowDecimals={false} tick={{ fill: "currentColor" }} stroke="currentColor" strokeOpacity={0.4} />
          <Tooltip
            labelFormatter={(hour) => formatDateTime(String(hour))}
            contentStyle={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid #a3a3a3" }}
          />
          <Legend />
          <Bar dataKey="volume" name={copy.volume} fill={COLORS.full} isAnimationActive={false}>
            {rows.map((row) => (
              <Cell key={row.hour} fill={row.is_complete ? COLORS.full : COLORS.running} />
            ))}
          </Bar>
          {spike.has_sufficient_baseline && (
            <ReferenceLine y={spike.threshold_rate} stroke={COLORS.threshold} strokeDasharray="6 4" label={{ value: copy.thresholdLine, fill: COLORS.threshold, position: "insideTopRight" }} />
          )}
          {spike.baseline_hours > 0 && (
            <ReferenceLine y={spike.mean} stroke={COLORS.mean} strokeDasharray="2 4" label={{ value: copy.meanLine, fill: COLORS.mean, position: "insideBottomRight" }} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
