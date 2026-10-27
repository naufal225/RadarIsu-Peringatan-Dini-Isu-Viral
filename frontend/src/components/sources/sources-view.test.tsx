import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/admin/sources" }));

import { IMPORT_RESULT, SOURCE_LIST, SOURCES } from "@/fixtures/sources";
import { ui } from "@/lib/labels";
import { canImport, canTest, emptySourceForm, fieldErrors, formFromSource, parseVideoIds, sourcePayload } from "@/lib/sources";
import { SourcesView, type ImportState, type SourceFormState, type SourcesViewProps } from "./sources-view";

const noop = () => undefined;
const form: SourceFormState = { open: false, mode: "create", sourceId: null, values: emptySourceForm(), errors: {}, pending: false, failed: false };
const imports: ImportState = { source: null, pending: false, result: null, fileErrors: [], failed: false, history: null };
const base: SourcesViewProps = {
  result: SOURCE_LIST,
  loading: false,
  failed: false,
  canManage: true,
  busyId: null,
  rowNotice: null,
  onTest: noop,
  onToggle: noop,
  onEdit: noop,
  onNew: noop,
  onImport: noop,
  form,
  onFormChange: noop,
  onFormSubmit: noop,
  onFormClose: noop,
  imports,
  onImportSubmit: noop,
  onImportClose: noop,
};
const render = (props: Partial<SourcesViewProps> = {}) => renderToString(createElement(SourcesView, { ...base, ...props }));

describe("source payloads", () => {
  it("builds an RSS create body with numbers and the type", () => {
    const values = { ...emptySourceForm("rss"), name: " Portal ", url: "https://x.test/rss", max_items: "20", interval_minutes: "30" };
    expect(sourcePayload(values, "create")).toEqual({
      type: "rss",
      name: "Portal",
      is_active: true,
      config: { url: "https://x.test/rss", max_items: 20 },
      interval_minutes: 30,
    });
  });

  it("never sends the type on edit, and sends no config or interval for CSV", () => {
    const body = sourcePayload({ ...emptySourceForm("csv"), name: "Arsip", is_active: false }, "edit");
    expect(body).toEqual({ name: "Arsip", is_active: false });
  });

  it("splits YouTube IDs on commas, spaces, and new lines", () => {
    expect(parseVideoIds("a1, b2\n c3  ,")).toEqual(["a1", "b2", "c3"]);
    expect(sourcePayload({ ...emptySourceForm("youtube"), name: "Kanal", video_ids: "a1,b2" }, "create").config).toEqual({ video_ids: ["a1", "b2"] });
  });

  it("maps nested 422 keys onto form fields and back-fills the edit form", () => {
    expect(fieldErrors({ errors: { "config.url": ["u"], "config.video_ids.1": ["v"], "config.video_ids": ["w"], name: ["n"] } })).toEqual({
      url: ["u"],
      video_ids: ["v", "w"],
      name: ["n"],
    });
    expect(formFromSource(SOURCES[2]).video_ids).toBe("dQw4w9WgXcQ\naBcDeFgHiJk");
  });

  it("tests only RSS/YouTube and imports only into CSV sources", () => {
    expect(SOURCES.filter(canTest).map((s) => s.type)).toEqual(["rss", "youtube"]);
    expect(SOURCES.filter(canImport).map((s) => s.type)).toEqual(["csv"]);
  });
});

describe("SourcesView", () => {
  it("shows status with icon and text, the last error, and marks the replay source as simulated", () => {
    const html = render();
    expect(html).toContain("Sehat");
    expect(html).toContain("Galat");
    expect(html).toContain("kuota habis");
    expect(html).toContain("DATA SIMULASI");
    expect(html).not.toMatch(/green-|emerald-/);
  });

  it("hides every management control without sources.manage", () => {
    const html = render({ canManage: false });
    for (const text of [ui.sources.newSource, ui.sources.test, ui.sources.import, ui.sources.edit]) expect(html).not.toContain(text);
  });

  it("offers test only for RSS/YouTube rows and no actions on replay sources", () => {
    const html = render();
    expect(html.split(`>${ui.sources.test}</button>`).length - 1).toBe(2);
    expect(html.split(`>${ui.sources.import}</button>`).length - 1).toBe(1);
    expect(html.split(`>${ui.sources.edit}</button>`).length - 1).toBe(3);
  });

  it("shows field errors inside the open form and the import summary with row problems", () => {
    const withErrors = render({ form: { ...form, open: true, values: emptySourceForm("rss"), errors: { url: ["url"] } } });
    expect(withErrors).toContain(ui.sources.url);
    const importOpen = render({ imports: { ...imports, source: SOURCES[0], result: IMPORT_RESULT } });
    expect(importOpen).toContain("humas-oktober.csv");
    expect(importOpen).toContain("Kolom text kosong");
  });

  it("states that there are no sources yet", () => {
    expect(render({ result: { data: [] } })).toContain(ui.sources.empty);
  });
});
