"use client";

import { SignalChart } from "@/components/charts/signal-chart";
import type { TrendPoint } from "@/lib/dashboard";

interface DashboardChartProps {
  data: TrendPoint[];
}

export function DashboardChart({ data }: DashboardChartProps) {
  return <SignalChart series={data} />;
}

