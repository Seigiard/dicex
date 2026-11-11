import { describe, it, expect } from "vitest";
import {
  isRollRequest,
  isIsReadyRequest,
  resolveHidden,
  resolveHiddenAudience,
  TRUSTED_ROLL_TARGET_SOURCES,
} from "./dicePlusProtocol";

describe("resolveHidden", () => {
  const trusted = "com.abottchen.obr-forge-helper";
  const untrusted = "com.example.unknown";

  it("trusts obr-forge-helper by default", () => {
    expect(TRUSTED_ROLL_TARGET_SOURCES).toContain(trusted);
  });

  it("honors rollTarget=everyone from a trusted source", () => {
    expect(resolveHidden(trusted, "everyone")).toBe(false);
  });

  it("hides rollTarget=everyone from an untrusted source", () => {
    expect(resolveHidden(untrusted, "everyone")).toBe(true);
  });

  it("hides private targets even from a trusted source", () => {
    expect(resolveHidden(trusted, "self")).toBe(true);
    expect(resolveHidden(trusted, "dm")).toBe(true);
    expect(resolveHidden(trusted, "gm_only")).toBe(true);
  });

  it("hides private targets from an untrusted source", () => {
    expect(resolveHidden(untrusted, "self")).toBe(true);
    expect(resolveHidden(untrusted, "dm")).toBe(true);
    expect(resolveHidden(untrusted, "gm_only")).toBe(true);
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

  it("gives everyone no audience, so its hidden fallback stays classic", () => {
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
