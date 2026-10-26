import { describe, expect, it } from "vitest";
import { summarizeEvidence } from "./coordination";
import { describeRule, describeRules, lookalikesQuery } from "./impersonation";
import { ui } from "./labels";

describe("describeRule", () => {
  it("phrases each rule the detector can report", () => {
    expect(describeRule({ rule: "unicode_folded" })).toBe("Karakter Unicode disamakan");
    expect(describeRule({ rule: "separators_removed" })).toBe("Pemisah dan spasi dibuang");
    expect(describeRule({ rule: "confusable_chars", pairs: ["0→o", "rn→m"] })).toBe("Karakter mirip disamakan (0→o, rn→m)");
    expect(describeRule({ rule: "trailing_digits_stripped", value: "2024" })).toBe("Angka di ujung dibuang (2024)");
  });

  it("says which end an affix was removed from", () => {
    expect(describeRule({ rule: "affix_stripped", value: "official", position: "suffix" })).toBe('Imbuhan "official" di akhir dibuang');
    expect(describeRule({ rule: "affix_stripped", value: "real", position: "prefix" })).toBe('Imbuhan "real" di awal dibuang');
  });

  it("copes with missing details and unknown rules", () => {
    expect(describeRule({ rule: "confusable_chars" })).toBe("Karakter mirip disamakan ()");
    expect(describeRule({ rule: "something_new" })).toBe("something_new");
  });
});

describe("describeRules", () => {
  it("keeps the order and tolerates no rules", () => {
    expect(describeRules([{ rule: "separators_removed" }, { rule: "unicode_folded" }])).toEqual([
      "Pemisah dan spasi dibuang",
      "Karakter Unicode disamakan",
    ]);
    expect(describeRules([])).toEqual([]);
    expect(describeRules(null)).toEqual([]);
    expect(describeRules(undefined)).toEqual([]);
  });
});

describe("lookalikesQuery", () => {
  it("always has a page and leaves the official filter out when none is chosen", () => {
    expect(lookalikesQuery(1, null)).toBe("page=1");
    expect(lookalikesQuery(3, 7)).toBe("page=3&official_account_id=7");
  });

  it("never asks for a page below one", () => {
    expect(lookalikesQuery(0, null)).toBe("page=1");
    expect(lookalikesQuery(-4, null)).toBe("page=1");
    expect(lookalikesQuery(2.9, null)).toBe("page=2");
  });
});

describe("summarizeEvidence for name_similarity", () => {
  const detail = {
    similarity: 0.857,
    field: "handle",
    official: { id: 1, handle: "@demo_kodam", display_name: "Demo Kodam Contoh" },
    same_name: false,
    rules: [{ rule: "affix_stripped", value: "official", position: "suffix" }],
  };

  it("names the official account, the similarity and the rules", () => {
    expect(summarizeEvidence("name_similarity", detail)).toBe(
      'Kemiripan 0,86 dengan akun resmi @demo_kodam (lewat handle). Aturan: Imbuhan "official" di akhir dibuang.',
    );
  });

  it("says when the names are the same once normalized and when the display name was compared", () => {
    const text = summarizeEvidence("name_similarity", { ...detail, similarity: 1, field: "display_name", same_name: true, rules: [] });

    expect(text).toBe("Kemiripan 1,00 dengan akun resmi @demo_kodam (lewat nama tampilan). Nama sama setelah dinormalisasi.");
  });

  it("returns null without the numbers it needs, so only the raw data is shown", () => {
    expect(summarizeEvidence("name_similarity", {})).toBeNull();
    expect(summarizeEvidence("name_similarity", { similarity: 0.9 })).toBeNull();
    expect(summarizeEvidence("name_similarity", { official: { handle: "@x" } })).toBeNull();
  });

  it("ignores a rules field that is not a list", () => {
    expect(summarizeEvidence("name_similarity", { ...detail, rules: "oops" })).toBe("Kemiripan 0,86 dengan akun resmi @demo_kodam (lewat handle).");
  });
});

describe("impersonation labels", () => {
  it("has no empty text", () => {
    const strings = [
      ui.impersonation.panel.title,
      ui.impersonation.panel.intro,
      ui.impersonation.panel.empty,
      ui.impersonation.panel.noOfficials,
      ui.impersonation.panel.young,
      ...Object.values(ui.impersonation.panel.columns),
      ...Object.values(ui.impersonation.panel.field),
      ...Object.values(ui.impersonation.evidence.fieldNames),
    ];

    for (const text of strings) expect(text.trim()).not.toBe("");
  });
});
