"use client";

import Link from "next/link";
import { useState } from "react";
import { ErrorText, Field, inputClass, Section, StatusBadge } from "@/components/ui";
import { formatDateTime, formatDecimal } from "@/lib/format";
import { spikeStatusLabels, ui } from "@/lib/labels";
import { DEFAULT_SPIKE_HOURS, isEmptySeries, SPIKE_HOUR_OPTIONS, spikeTone, type SpikeBaselineResponse } from "@/lib/spike";
import { useApiData } from "@/lib/use-api-data";
import { SpikeChart } from "./spike-chart";

const copy = ui.detection.spike;

/** Spike detection of one topic: the chart, the numbers behind it, and why the detector would or would not fire. */
export function SpikePanel({ id }: { id: number }) {
  const [hours, setHours] = useState<number>(DEFAULT_SPIKE_HOURS);
  const { data, error } = useApiData<SpikeBaselineResponse>(`topics/${id}/spike-baseline?hours=${hours}`);
  const spike = data?.data.spike;

  return (
    <Section title={copy.title}>
      <p className="mb-3 max-w-3xl text-sm text-neutral-600">{copy.intro}</p>
      <ErrorText>{error ? ui.common.loadError : null}</ErrorText>

      <div className="mb-4 max-w-xs">
        <Field label={copy.hours}>
          <select name="spike_hours" value={hours} onChange={(e) => setHours(Number(e.target.value))} className={inputClass}>
            {SPIKE_HOUR_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {copy.hoursOption(option)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {data === null || spike === undefined ? (
        <p className="text-sm text-neutral-500">{ui.loading}</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <StatusBadge tone={spikeTone(spike.status)}>{spikeStatusLabels[spike.status]}</StatusBadge>
            <span className="text-neutral-600">{copy.asOf(formatDateTime(data.data.as_of))}</span>
            <span className="text-neutral-600">{copy.sensitivity(spike.thresholds.sensitivity, formatDecimal(spike.thresholds.sensitivity_z_offset, 1, 1))}</span>
            {spike.triggered && (
              <Link href="/alerts" className="underline">
                {copy.alertsLink}
              </Link>
            )}
          </div>

          {!spike.has_sufficient_baseline && (
            <p className="mb-3 text-sm text-neutral-600">{copy.insufficient(spike.baseline_hours, spike.thresholds.min_baseline_hours)}</p>
          )}

          <dl className="mb-4 grid max-w-4xl gap-3 text-sm sm:grid-cols-3">
            <Stat label={copy.current} value={String(spike.current)} hint={copy.currentHint(spike.thresholds.current_window_minutes)} />
            <Stat label={copy.baselineMean} value={formatDecimal(spike.mean, 0, 1)} hint={`${copy.baselineStd}: ${formatDecimal(spike.std, 0, 1)}`} />
            <Stat label={copy.baselineHours} value={String(spike.baseline_hours)} />
            <Stat label={copy.z} value={formatDecimal(spike.z, 0, 2)} hint={`${copy.zNeeded}: ${formatDecimal(spike.z_effective, 0, 2)}`} />
            <Stat label={copy.threshold} value={spike.has_sufficient_baseline ? formatDecimal(spike.threshold_rate, 0, 1) : ui.common.none} />
            <Stat label={copy.minVolume} value={String(spike.thresholds.min_volume)} />
          </dl>

          {isEmptySeries(data.data.series) ? <p className="text-sm text-neutral-500">{copy.empty}</p> : <SpikeChart series={data.data.series} spike={spike} />}
          <p className="mt-1 text-xs text-neutral-500">{copy.runningHour}</p>
        </>
      )}
    </Section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-neutral-200 px-3 py-2">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
      {hint && <dd className="text-xs text-neutral-500">{hint}</dd>}
    </div>
  );
}
