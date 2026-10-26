"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDateTime } from "@/lib/format";
import { ui } from "@/lib/labels";
import type { TrendPoint } from "@/lib/dashboard";

const axisTime = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

interface DashboardChartProps {
  data: TrendPoint[];
}

export function DashboardChart({ data }: DashboardChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-neutral-300 dark:border-neutral-800 text-sm text-neutral-500">
        {ui.dashboard.trend.noData}
      </div>
    );
  }

  return (
    <div className="h-72 w-full text-xs" role="img" aria-label={ui.dashboard.trend.title}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: -16 }}>
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="currentColor" strokeOpacity={0.1} vertical={false} />
          <XAxis
            dataKey="hour"
            tickFormatter={(hour: string) => axisTime.format(new Date(hour))}
            minTickGap={32}
            tick={{ fill: "currentColor" }}
            stroke="currentColor"
            strokeOpacity={0.3}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "currentColor" }}
            stroke="currentColor"
            strokeOpacity={0.3}
          />
          <Tooltip
            labelFormatter={(hour) => `${formatDateTime(String(hour))} UTC`}
            formatter={(val) => [
              `${Number(val ?? 0).toLocaleString("id-ID")} ${ui.dashboard.trend.postsCount}`,
              ui.dashboard.trend.volume,
            ]}
            contentStyle={{
              backgroundColor: "var(--background, #ffffff)",
              borderColor: "var(--border, #e5e7eb)",
              color: "var(--foreground, #111827)",
              borderRadius: "0.5rem",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
          />
          <Area
            type="monotone"
            dataKey="volume"
            stroke="#2563eb"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#trendGradient)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
