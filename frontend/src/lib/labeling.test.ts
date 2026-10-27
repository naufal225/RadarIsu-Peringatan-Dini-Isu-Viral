import { describe, expect, it } from "vitest";
import { labelingPercent, labelingQuery } from "./labeling";
import { labelingUi } from "./labels/labeling";

describe("labelingQuery", () => {
  it("leaves out defaults", () => {
    expect(labelingQuery({ status: "all", simulatedOnly: false, page: 1 })).toBe("labeling/posts?page=1");
  });

  it("adds the active filters", () => {
    expect(labelingQuery({ status: "unlabeled", simulatedOnly: true, page: 3 })).toBe("labeling/posts?status=unlabeled&is_simulated=1&page=3");
  });

  it("never asks for a page below 1", () => {
    expect(labelingQuery({ status: "labeled", simulatedOnly: false, page: 0 })).toBe("labeling/posts?status=labeled&page=1");
  });
});

describe("labelingPercent", () => {
  it("is a whole percent capped at 100", () => {
    expect(labelingPercent({ labeled: 50, target: 200 })).toBe(25);
    expect(labelingPercent({ labeled: 250, target: 200 })).toBe(100);
    expect(labelingPercent({ labeled: 5, target: 0 })).toBe(0);
  });
});

describe("labeling labels", () => {
  it("formats progress in Indonesian", () => {
    expect(labelingUi.progress("12", "200")).toBe("12 dari ±200 diberi label");
    expect(labelingUi.breakdown("7", "5")).toBe("Organik 7, Tidak Wajar 5");
  });
});
