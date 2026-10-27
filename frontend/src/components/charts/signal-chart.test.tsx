import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));

import { ClearFilters, FilterSelect } from "@/components/radar/filter-bar";
import { Pagination } from "@/components/radar/pagination";
import { Stat } from "@/components/radar/stat";
import { SIGNAL_BASELINE, SIGNAL_MARKERS, SIGNAL_SERIES, SIGNAL_THRESHOLD, SIGNAL_WINDOW } from "@/fixtures/signal";
import { ui } from "@/lib/labels";
import { SignalChart } from "./signal-chart";

const html = (element: React.ReactElement) => renderToString(element);

describe("SignalChart states", () => {
  it("says so when there is no data, instead of drawing an empty chart", () => {
    const out = html(<SignalChart series={[]} />);
    expect(out).toContain(ui.chart.empty);
    expect(out).not.toContain("<details");
  });

  it("shows a busy skeleton while loading and an alert with retry on error", () => {
    expect(html(<SignalChart series={SIGNAL_SERIES} loading />)).toContain('aria-busy="true"');
    const error = html(<SignalChart series={[]} error={{ onRetry: () => undefined }} />);
    expect(error).toContain('role="alert"');
    expect(error).toContain(ui.state.retry);
  });
});

describe("SignalChart honesty about the reference line", () => {
  it("labels the plain average as not being the detection baseline when the server sent no baseline", () => {
    const out = html(<SignalChart series={SIGNAL_SERIES} />);
    expect(out).toContain(ui.chart.referenceRange);
    expect(out).not.toContain(ui.chart.referenceBaseline);
    expect(out).not.toContain(ui.chart.threshold);
  });

  it("uses the server baseline and threshold when given, and never the range average", () => {
    const out = html(<SignalChart series={SIGNAL_SERIES} baseline={SIGNAL_BASELINE} threshold={SIGNAL_THRESHOLD} />);
    expect(out).toContain(ui.chart.referenceBaseline);
    expect(out).toContain(ui.chart.threshold);
    expect(out).not.toContain(ui.chart.referenceRange);
  });

  it("draws no threshold of its own when only a baseline is given", () => {
    const out = html(<SignalChart series={SIGNAL_SERIES} baseline={SIGNAL_BASELINE} />);
    expect(out).not.toContain(ui.chart.threshold);
  });
});

describe("SignalChart accessibility", () => {
  it("describes the chart for screen readers and offers the data as a table", () => {
    const out = html(<SignalChart series={SIGNAL_SERIES} markers={SIGNAL_MARKERS} />);
    expect(out).toMatch(/role="img"[^>]*aria-label="Grafik volume per jam, 48 titik\. Puncak 160/);
    expect(out).toContain(ui.chart.viewAsTable);
    expect(out.match(/<tr class="h-8"/g)).toHaveLength(48);
  });

  it("lists pins in the table and reports markers outside the range", () => {
    const out = html(<SignalChart series={SIGNAL_SERIES} markers={SIGNAL_MARKERS} window={SIGNAL_WINDOW} />);
    expect(out).toContain("Tinggi: Lonjakan topik layanan publik");
    expect(out).toContain(ui.chart.droppedMarkers(1));
    expect(out).toContain(ui.chart.window);
  });

  it("omits legend and table in the compact variant", () => {
    const out = html(<SignalChart series={SIGNAL_SERIES} variant="compact" />);
    expect(out).not.toContain("<details");
    expect(out).not.toContain(ui.chart.volume);
  });
});

describe("P2 components", () => {
  it("Stat shows a plain number, label and hint", () => {
    const out = html(<Stat label="Alert aktif" value="1.284" hint="Dari data contoh" />);
    expect(out).toContain("1.284");
    expect(out).toContain("tabular-nums");
    expect(out).toContain("Dari data contoh");
  });

  it("Pagination reports the range with thousand dots and disables the edges", () => {
    const out = html(<Pagination page={1} perPage={25} total={1300} onPageChange={() => undefined} />);
    expect(out).toContain("1–25 dari 1.300");
    expect(out).toContain("Halaman 1 dari 52");
    expect(out).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*?Sebelumnya/);
    expect(html(<Pagination page={1} perPage={25} total={0} onPageChange={() => undefined} />)).toContain("0–0 dari 0");
  });

  it("FilterSelect has an All option and ClearFilters only shows when a filter is active", () => {
    const select = html(<FilterSelect label="Severity" value="" options={[{ value: "high", label: "Tinggi" }]} onChange={() => undefined} />);
    expect(select).toContain(ui.filters.all);
    expect(select).toContain("Tinggi");
    expect(html(<ClearFilters active={false} onClear={() => undefined} />)).toBe("");
    expect(html(<ClearFilters active onClear={() => undefined} />)).toContain(ui.filters.clear);
  });
});
