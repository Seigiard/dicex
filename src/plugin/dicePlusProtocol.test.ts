import { describe, it, expect } from "vitest";
import {
  isRollRequest,
  isIsReadyRequest,
  resolveHidden,
  resolveHiddenAudience,
} from "./dicePlusProtocol";

describe("resolveHidden", () => {
  it("shows rollTarget=everyone", () => {
    expect(resolveHidden("everyone")).toBe(false);
  });

  it("hides the private targets", () => {
    expect([
      resolveHidden("self"),
      resolveHidden("dm"),
      resolveHidden("gm_only"),
    ]).toEqual([true, true, true]);
  });
});

describe("resolveHiddenAudience", () => {
  it("keeps a self roll to the roller", () => {
    expect(resolveHiddenAudience("self")).toBe("self");
  });

  it("shows a dm roll to the GM", () => {
    expect(resolveHiddenAudience("dm")).toBe("gm");
  });

  it("shows a gm_only roll to the GM", () => {
    expect(resolveHiddenAudience("gm_only")).toBe("gm");
  });

  it("gives everyone no audience", () => {
    expect(resolveHiddenAudience("everyone")).toBeUndefined();
  });
});

describe("isRollRequest", () => {
  const valid = {
    rollId: "r",
    playerId: "p",
    playerName: "n",
    rollTarget: "everyone" as const,
    diceNotation: "1d20",
    showResults: true,
    timestamp: 0,
    source: "src",
  };

  it("accepts a well-formed payload", () => {
    expect(isRollRequest(valid)).toBe(true);
  });

  it("rejects null and non-objects", () => {
    expect(isRollRequest(null)).toBe(false);
    expect(isRollRequest(undefined)).toBe(false);
    expect(isRollRequest("hello")).toBe(false);
    expect(isRollRequest(42)).toBe(false);
  });

  it("rejects payloads missing required string fields", () => {
    expect(isRollRequest({ ...valid, rollId: undefined })).toBe(false);
    expect(isRollRequest({ ...valid, diceNotation: 1 })).toBe(false);
    expect(isRollRequest({ ...valid, source: null })).toBe(false);
  });

  it("rejects an unknown rollTarget", () => {
    expect(isRollRequest({ ...valid, rollTarget: "everybody" })).toBe(false);
  });

  it("accepts each known rollTarget", () => {
    for (const target of ["everyone", "self", "dm", "gm_only"]) {
      expect(isRollRequest({ ...valid, rollTarget: target })).toBe(true);
    }
  });

  it("accepts unknown rollIn values", () => {
    expect([
      isRollRequest({ ...valid, rollIn: "sideways" }),
      isRollRequest({ ...valid, rollIn: 7 }),
    ]).toEqual([true, true]);
  });
});

describe("isIsReadyRequest", () => {
  it("accepts a well-formed request", () => {
    expect(isIsReadyRequest({ requestId: "r", timestamp: 1 })).toBe(true);
  });

  it("rejects our own response (ready: true)", () => {
    expect(
      isIsReadyRequest({ requestId: "r", ready: true, timestamp: 1 })
    ).toBe(false);
  });

  it("rejects malformed payloads", () => {
    expect(isIsReadyRequest(null)).toBe(false);
    expect(isIsReadyRequest({})).toBe(false);
    expect(isIsReadyRequest({ requestId: 42 })).toBe(false);
  });
});
