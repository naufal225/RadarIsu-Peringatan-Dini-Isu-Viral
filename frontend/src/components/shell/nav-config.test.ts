import { describe, expect, it } from "vitest";
import type { Permission } from "@/lib/permissions";
import { NAV_GROUPS, homePath, isActive, visibleGroups } from "./nav-config";

const canOf = (...granted: Permission[]) => (permission: Permission) => granted.includes(permission);
const hrefs = (can: (p: Permission) => boolean) => visibleGroups(can).flatMap((g) => g.items.map((i) => i.href));

describe("nav config", () => {
  it("registers every PRD §12.2 route exactly once, in 4 groups", () => {
    const all = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(all).toEqual([
      "/dashboard", "/alerts", "/briefings", "/topics", "/labeling", "/evaluation",
      "/admin/status", "/admin/sources", "/admin/users", "/admin/replay", "/admin/settings", "/admin/audit",
    ]);
    expect(NAV_GROUPS).toHaveLength(4);
  });

  it("shows only the items a user has permission for", () => {
    expect(hrefs(canOf())).toEqual([]);
    expect(hrefs(canOf("alerts.view", "labels.manage"))).toEqual(["/alerts", "/labeling"]);
  });

  it("drops groups left without items", () => {
    const groups = visibleGroups(canOf("audit.view"));
    expect(groups.map((g) => g.id)).toEqual(["admin"]);
  });

  it("lands on the dashboard when allowed, on system status for an admin without it", () => {
    expect(homePath(canOf("dashboard.view", "system.status"))).toBe("/dashboard");
    expect(homePath(canOf("system.status", "users.view"))).toBe("/admin/status");
    expect(homePath(canOf("topics.view"))).toBe("/topics");
    expect(homePath(canOf())).toBe("/dashboard");
  });

  it("marks a page and its children as active, not look-alike prefixes", () => {
    expect(isActive("/alerts", "/alerts")).toBe(true);
    expect(isActive("/alerts/12", "/alerts")).toBe(true);
    expect(isActive("/alerts-old", "/alerts")).toBe(false);
  });
});
