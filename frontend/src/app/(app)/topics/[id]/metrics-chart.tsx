"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDateTime } from "@/lib/format";
import { sentimentLabels, ui } from "@/lib/labels";
import type { HourlyMetric } from "@/lib/topics";

const axisTime = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const COLORS = { positive: "#16a34a", neutral: "#9ca3af", negative: "#dc2626" } as const;

/** Posts per hour, stacked by sentiment. Quiet hours are rows of zeros, see fillHours(). */
export function MetricsChart({ rows }: { rows: HourlyMetric[] }) {
  return (
    <div className="h-80 w-full max-w-5xl text-xs" role="img" aria-label={ui.topics.detail.chartTitle}>
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
          {/* No animation: up to 744 bars, and a chart that only draws once its animation runs hides the data when it stalls. */}
          <Bar dataKey="positive_count" name={sentimentLabels.positive} stackId="sentiment" fill={COLORS.positive} isAnimationActive={false} />
          <Bar dataKey="neutral_count" name={sentimentLabels.neutral} stackId="sentiment" fill={COLORS.neutral} isAnimationActive={false} />
          <Bar dataKey="negative_count" name={sentimentLabels.negative} stackId="sentiment" fill={COLORS.negative} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
