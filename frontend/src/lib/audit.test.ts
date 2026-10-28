import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/admin/audit" }));

import { AuditView, type AuditViewProps } from "@/components/audit/audit-view";
import { AUDIT_EMPTY, AUDIT_PAGE, AUDIT_USERS } from "@/fixtures/audit";
import { auditQuery, detailSummary, detailText, EMPTY_AUDIT_FILTERS, filterErrors, hasActiveFilters, objectLabel } from "./audit";
import { ui } from "./labels";

describe("audit query", () => {
  it("leaves out empty filters and never asks for page 0", () => {
    expect(auditQuery(EMPTY_AUDIT_FILTERS, 1)).toBe("audit-logs?page=1");
    expect(auditQuery({ user_id: "2", action: "label.set", from: "2026-10-01", to: " " }, 0)).toBe(
      "audit-logs?page=1&user_id=2&action=label.set&from=2026-10-01",
    );
  });

  it("knows when a filter is active", () => {
    expect(hasActiveFilters(EMPTY_AUDIT_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_AUDIT_FILTERS, to: "2026-10-27" })).toBe(true);
  });
});

describe("audit cells", () => {
  it("labels the object, or nothing", () => {
    expect(objectLabel({ object_type: "alert", object_id: 17 })).toBe("alert #17");
    expect(objectLabel({ object_type: "settings", object_id: null })).toBe("settings");
    expect(objectLabel({ object_type: null, object_id: null })).toBeNull();
  });

  it("pretty-prints the detail and hides an empty one", () => {
    expect(detailText({})).toBeNull();
    expect(detailText(null)).toBeNull();
    expect(detailText({ from: "a", to: "b" })).toBe('{\n  "from": "a",\n  "to": "b"\n}');
  });

  it("summarises the detail: from → to first, plain pairs, nested values left to the full JSON", () => {
    expect(detailSummary({ from: "escalated", to: "approved", note: "Setuju" })).toEqual({
      parts: [
        { key: null, value: "escalated → approved" },
        { key: "note", value: "Setuju" },
      ],
      more: false,
    });
    expect(detailSummary({ changes: ["name", "is_active"] }).parts).toEqual([{ key: "changes", value: "name, is_active" }]);
    expect(detailSummary({ key: "detection", changes: { z_threshold: [3, 3.5] } })).toEqual({ parts: [{ key: "key", value: "detection" }], more: true });
    expect(detailSummary({ a: 1, b: 2, c: 3, d: 4 })).toEqual({
      parts: [
        { key: "a", value: "1" },
        { key: "b", value: "2" },
        { key: "c", value: "3" },
      ],
      more: true,
    });
    expect(detailSummary({ speed_factor: 48000, f1: 0.8333 }).parts).toEqual([
      { key: "speed_factor", value: "48.000" },
      { key: "f1", value: "0,833" },
    ]);
    expect(detailSummary({}).parts).toEqual([]);
    expect(detailSummary({ error: null, status: "ok" })).toEqual({ parts: [{ key: "status", value: "ok" }], more: false });
  });

  it("maps 422 field errors to the filters", () => {
    expect(filterErrors({ errors: { to: ["x"], page: ["y"] } })).toEqual({ to: ["x"] });
    expect(filterErrors(null)).toEqual({});
  });
});

describe("AuditView", () => {
  const base: AuditViewProps = {
    result: AUDIT_PAGE,
    loading: false,
    failed: false,
    users: AUDIT_USERS,
    filters: EMPTY_AUDIT_FILTERS,
    filterErrors: {},
    onFiltersChange: () => undefined,
    onPageChange: () => undefined,
  };
  const render = (props: Partial<AuditViewProps> = {}) => renderToString(createElement(AuditView, { ...base, ...props }));

  it("shows UTC inline for every row, without hover", () => {
    const html = render();
    expect(html).toContain("14.31 WIB");
    expect(html).toContain("07.31 UTC");
    expect(html.match(/UTC<\/span>/g)?.length).toBe(AUDIT_PAGE.data.length);
  });

  it("names the system for entries without a user and labels actions from PRD §9.7", () => {
    const html = render();
    expect(html).toContain(ui.audit.system);
    expect(html).toContain("Alert disetujui");
    expect(html).toContain("Alert");
    expect(html).toMatch(/#(<!-- -->)?17/);
  });

  it("escapes the detail and has no edit or delete control", () => {
    const html = render({
      result: { ...AUDIT_PAGE, data: [{ ...AUDIT_PAGE.data[0], detail: { note: "<script>alert(1)</script>" } }] },
    });
    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toMatch(/Ubah|Hapus|Edit|Delete/);
  });

  it("shows the total, worded for a filtered result", () => {
    expect(render()).toContain(ui.audit.count(String(AUDIT_PAGE.meta.total)));
    expect(render({ filters: { ...EMPTY_AUDIT_FILTERS, action: "alert.approve" } })).toContain(ui.audit.countFiltered(String(AUDIT_PAGE.meta.total)));
  });

  it("states that nothing matched the filter, shows a retryable error, and a range error under the field", () => {
    expect(render({ result: AUDIT_EMPTY })).toContain(ui.audit.empty);
    expect(render({ result: null, failed: true })).toContain('role="alert"');
    expect(render({ filterErrors: { to: ["after_or_equal"] } })).toContain(ui.audit.invalidRange);
  });
});
