import { describe, expect, it } from "vitest";
import { calculatePeakHour, calculateTotalVolume, severityTone, type TrendPoint } from "./dashboard";

describe("dashboard utilities", () => {
  it("calculates total volume across 24h trend points", () => {
    const points: TrendPoint[] = [
      { hour: "2026-10-26T10:00:00Z", volume: 15 },
      { hour: "2026-10-26T11:00:00Z", volume: 45 },
      { hour: "2026-10-26T12:00:00Z", volume: 0 },
      { hour: "2026-10-26T13:00:00Z", volume: 30 },
    ];

    expect(calculateTotalVolume(points)).toBe(90);
    expect(calculateTotalVolume([])).toBe(0);
  });

  it("identifies the peak volume hour from the trend series", () => {
    const points: TrendPoint[] = [
      { hour: "2026-10-26T10:00:00Z", volume: 10 },
      { hour: "2026-10-26T11:00:00Z", volume: 85 },
      { hour: "2026-10-26T12:00:00Z", volume: 42 },
    ];

    const peak = calculatePeakHour(points);
    expect(peak).not.toBeNull();
    expect(peak?.hour).toBe("2026-10-26T11:00:00Z");
    expect(peak?.volume).toBe(85);
  });

  it("returns null peak hour when trend is empty or volume is zero", () => {
    expect(calculatePeakHour([])).toBeNull();
    expect(
      calculatePeakHour([
        { hour: "2026-10-26T10:00:00Z", volume: 0 },
        { hour: "2026-10-26T11:00:00Z", volume: 0 },
      ]),
    ).toBeNull();
  });

  it("maps severity levels to badge tones correctly", () => {
    expect(severityTone("high")).toBe("error");
    expect(severityTone("medium")).toBe("warn");
    expect(severityTone("low")).toBe("ok");
    expect(severityTone(null)).toBe("muted");
    expect(severityTone(undefined)).toBe("muted");
  });

  it("exports valid Indonesian labels for all dashboard UI elements", async () => {
    const { ui } = await import("./labels");
    expect(ui.dashboard.title).toBe("Dasbor situasi");
    expect(ui.dashboard.kpi.activeIssues).toBe("Isu Aktif");
    expect(ui.dashboard.kpi.highestSeverity).toBe("Keparahan Tertinggi");
    expect(ui.dashboard.kpi.awaitingDecision).toBe("Menunggu Keputusan");
    expect(ui.dashboard.trend.volume).toBe("Volume Posting");
    expect(ui.dashboard.issues.viewAllAlerts).toBe("Lihat Semua Alert");
    expect(ui.dashboard.quickLinks.triageAlerts).toBe("Triase Alert Baru");
  });
});
