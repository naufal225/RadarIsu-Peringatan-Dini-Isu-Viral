import { describe, expect, it } from "vitest";
import { hasPermission, PERMISSIONS, ROLE_PERMISSIONS, ROLES } from "./permissions";

// PRD §8.2–§8.3 and the §11.1 /auth/me example.
describe("generated permissions", () => {
  it("declares the 20 permission slugs exactly once", () => {
    expect(PERMISSIONS).toHaveLength(20);
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it("has a matrix entry for every role and only known slugs", () => {
    expect([...ROLES].sort()).toEqual(["admin", "analyst", "leader"]);
    for (const role of ROLES) {
      for (const slug of ROLE_PERMISSIONS[role]) expect(PERMISSIONS).toContain(slug);
    }
  });

  it("matches the analyst permissions shown in §11.1", () => {
    expect(ROLE_PERMISSIONS.analyst).toEqual([
      "topics.view",
      "topics.manage",
      "dashboard.view",
      "alerts.view",
      "alerts.triage",
      "briefings.view",
      "briefings.create",
      "briefings.download",
      "labels.manage",
      "evaluation.view",
      "evaluation.run",
    ]);
  });

  it("keeps the separation of duties", () => {
    const holders = (slug: (typeof PERMISSIONS)[number]) => ROLES.filter((r) => ROLE_PERMISSIONS[r].includes(slug));

    expect(holders("alerts.triage")).toEqual(["analyst"]);
    expect(holders("alerts.decide")).toEqual(["leader"]);
    expect(holders("alerts.view")).toEqual(["analyst", "leader"]);
    expect(holders("users.manage")).toEqual(["admin"]);
    expect(holders("evaluation.view")).toEqual(["admin", "analyst", "leader"]);
    expect(holders("evaluation.run")).toEqual(["admin", "analyst"]);
  });

  it("hasPermission checks membership", () => {
    expect(hasPermission(ROLE_PERMISSIONS.leader, "alerts.decide")).toBe(true);
    expect(hasPermission(ROLE_PERMISSIONS.leader, "alerts.triage")).toBe(false);
    expect(hasPermission([], "dashboard.view")).toBe(false);
  });
});
