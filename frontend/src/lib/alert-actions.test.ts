import { describe, expect, it } from "vitest";
import { availableActions } from "./alert-actions";

const ANALYST = ["alerts.view", "alerts.triage"];
const LEADER = ["alerts.view", "alerts.decide"];

describe("availableActions", () => {
  it("lets an analyst take a new alert and nothing else to decide", () => {
    expect(availableActions(ANALYST, "new")).toEqual(["take", "comment"]);
  });

  it("gives an analyst the triage decisions while reviewing or returned", () => {
    expect(availableActions(ANALYST, "reviewing")).toEqual(["escalate", "false-positive", "close", "comment"]);
    expect(availableActions(ANALYST, "returned")).toEqual(["escalate", "false-positive", "close", "comment"]);
  });

  it("gives a leader approve and return only on escalated alerts", () => {
    expect(availableActions(LEADER, "escalated")).toEqual(["approve", "return", "comment"]);
    expect(availableActions(LEADER, "reviewing")).toEqual(["comment"]);
  });

  it("leaves only comment on terminal statuses", () => {
    expect(availableActions(ANALYST, "approved")).toEqual(["comment"]);
    expect(availableActions(ANALYST, "closed")).toEqual(["comment"]);
  });

  it("offers nothing that needs a permission the user lacks", () => {
    expect(availableActions([], "new")).toEqual([]);
    expect(availableActions(["alerts.view"], "escalated")).toEqual(["comment"]);
  });
});
