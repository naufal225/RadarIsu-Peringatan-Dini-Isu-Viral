import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));

import { alertStatusLabels, severityLabels } from "@/lib/labels";
import { DataTable } from "./data-table";
import { Pagination } from "./pagination";
import { SkeletonRows } from "./skeleton";
import { SeverityBadge } from "./severity-badge";
import { SimBadge, SimulationBanner } from "./simulation";
import { StatusChip } from "./status-chip";
import { Waktu } from "./waktu";
import type { AlertStatus, Severity } from "./types";

describe("SeverityBadge", () => {
  it("is always icon plus label, for every severity", () => {
    for (const severity of Object.keys(severityLabels) as Severity[]) {
      const html = renderToString(<SeverityBadge severity={severity} />);
      expect(html).toContain(severityLabels[severity]);
      expect(html).toContain("<svg");
    }
  });
});

describe("StatusChip", () => {
  it("labels all seven statuses from the PRD §14 map, monochrome", () => {
    for (const status of Object.keys(alertStatusLabels) as AlertStatus[]) {
      const html = renderToString(<StatusChip status={status} />);
      expect(html).toContain(alertStatusLabels[status]);
      expect(html).toContain("<svg");
      expect(html).not.toMatch(/sev-|sim|brand-fg/);
    }
  });
});

describe("Waktu", () => {
  const iso = "2026-10-27T07:29:00Z";

  it("shows WIB in a focusable <time> with the UTC tooltip", () => {
    const html = renderToString(<Waktu value={iso} />);
    expect(html).toContain("27 Okt 2026 · 14.29 WIB");
    expect(html).toMatch(/<time[^>]*datetime="2026-10-27T07:29:00.000Z"/i);
    expect(html).toMatch(/<time[^>]*tabindex="0"/);
    expect(html).toContain("07.29 UTC");
  });

  it("prints UTC as a second line when inline", () => {
    const html = renderToString(<Waktu value={iso} utc="inline" />);
    expect(html).toContain("14.29 WIB");
    expect(html).toContain("07.29 UTC");
    expect(html).not.toContain('role="tooltip"');
  });

  it("renders a dash for empty and invalid values", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(renderToString(<Waktu value={null} />)).toContain("—");
    expect(renderToString(<Waktu value="bukan tanggal" />)).toContain("—");
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("DataTable", () => {
  type Row = { id: number; name: string; severity: Severity };
  const columns = [
    { id: "name", header: "Nama", cell: (r: Row) => r.name },
    { id: "severity", header: "Severity", cell: (r: Row) => r.severity },
  ];
  const rows: Row[] = [{ id: 1, name: "Satu", severity: "high" }];

  it("links the first cell, adds the severity bar and a caption", () => {
    const html = renderToString(
      <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} rowHref={(r) => `/x/${r.id}`} rowSeverity={(r) => r.severity} caption="Contoh" />,
    );
    expect(html).toMatch(/<a[^>]*href="\/x\/1"[^>]*>Satu<\/a>/);
    expect(html).toContain("border-l-sev-high");
    expect(html).toContain('<caption class="sr-only">Contoh</caption>');
    expect(html).toContain('scope="col"');
  });

  it("shows a skeleton while loading, an alert on error and the empty node when there are no rows", () => {
    const base = { columns, getRowKey: (r: Row) => r.id, caption: "Contoh" };
    expect(renderToString(<DataTable {...base} rows={[]} loading />)).toContain('aria-busy="true"');
    expect(renderToString(<DataTable {...base} rows={[]} error={{}} />)).toContain('role="alert"');
    expect(renderToString(<DataTable {...base} rows={[]} empty={<p>Kosong khusus</p>} />)).toContain("Kosong khusus");
    expect(renderToString(<DataTable {...base} rows={[]} />)).toContain("Tidak ada data");
  });
});

describe("Pagination", () => {
  it("shows only the summary when everything fits on one page", () => {
    const one = renderToString(<Pagination page={1} perPage={50} total={4} onPageChange={() => undefined} />);
    expect(one).toContain("dari");
    expect(one).not.toContain("<button");
    const many = renderToString(<Pagination page={1} perPage={50} total={120} onPageChange={() => undefined} />);
    expect(many.match(/<button/g)?.length).toBe(2);
  });
});

describe("simulation markers", () => {
  it("states that the numbers are not real and shows the data clock only when given", () => {
    expect(renderToString(<SimulationBanner />)).toContain("DATA SIMULASI");
    expect(renderToString(<SimulationBanner />)).not.toContain("Jam data");
    expect(renderToString(<SimulationBanner dataClock="2026-10-27T07:29:00Z" />)).toContain("Jam data");
    expect(renderToString(<SimBadge />)).toContain("DATA SIMULASI");
  });

  it("skeletons are announced as busy", () => {
    expect(renderToString(<SkeletonRows />)).toContain('aria-busy="true"');
  });
});

/** Guard Design System §2: no colour literals, gradients or dark variants in foundation code. */
describe("foundation code obeys the token rules", () => {
  const roots = ["components/radar", "components/shell", "components/charts"].map((p) => join(__dirname, "../..", p));
  const files = roots.flatMap((root) => collect(root)).filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\./.test(f));

  function collect(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? collect(path) : [path];
    });
  }

  it("finds the files to check", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files)("%s has no hex/rgb/hsl, arbitrary colours, gradients, dark: or green", (file) => {
    const source = readFileSync(file, "utf8");
    expect(source).not.toMatch(/#[0-9A-Fa-f]{3,8}\b|rgba?\(|hsla?\(|\[#/);
    expect(source).not.toMatch(/gradient|\bdark:|green-|emerald-|dangerouslySetInnerHTML|shadow-/);
  });
});
