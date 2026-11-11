import { describe, it, expect } from "vitest";
import {
  isRollRequest,
  isIsReadyRequest,
  resolveHidden,
} from "./dicePlusProtocol";

describe("resolveHidden", () => {
  it("shows rollTarget=everyone when the player allows the source", () => {
    expect(resolveHidden("everyone", "allowed")).toBe(false);
  });

  it("hides rollTarget=everyone while the player has not answered", () => {
    expect(resolveHidden("everyone", "unasked")).toBe(true);
  });

  it("hides rollTarget=everyone when the player denied the source", () => {
    expect(resolveHidden("everyone", "denied")).toBe(true);
  });

  it("hides private targets even from an allowed source", () => {
    expect(resolveHidden("self", "allowed")).toBe(true);
    expect(resolveHidden("dm", "allowed")).toBe(true);
    expect(resolveHidden("gm_only", "allowed")).toBe(true);
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
