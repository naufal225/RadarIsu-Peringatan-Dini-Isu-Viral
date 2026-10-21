import { describe, expect, it } from "vitest";
import { formatDateTime, invalidFields } from "./format";
import { ui } from "./labels";

describe("formatDateTime", () => {
  it("renders a dash for empty values", () => {
    expect(formatDateTime(null)).toBe(ui.common.none);
    expect(formatDateTime(undefined)).toBe(ui.common.none);
  });

  it("formats ISO strings and passes unparseable values through", () => {
    expect(formatDateTime("2026-10-20T08:15:00Z")).toMatch(/2026/);
    expect(formatDateTime("bukan tanggal")).toBe("bukan tanggal");
  });
});

describe("invalidFields", () => {
  it("lists the fields of a Laravel 422 body", () => {
    expect(invalidFields({ errors: { email: ["taken"], password: ["short"] } })).toEqual(["email", "password"]);
    expect(invalidFields(null)).toEqual([]);
  });
});
