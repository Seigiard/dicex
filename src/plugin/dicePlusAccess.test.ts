import { describe, it, expect, beforeEach } from "vitest";
import { obrConfig, resetObrCalls } from "../integration/setup";
import {
  ACCESS_METADATA_KEY,
  accessDecision,
  forgetAccessDecision,
  readAccessList,
  recordAccessDecision,
  withDecision,
} from "./dicePlusAccess";

describe("readAccessList", () => {
  it("reads an empty list when the room has no record", () => {
    expect(readAccessList({})).toEqual({ allowed: [], denied: [] });
  });

  it("drops malformed entries", () => {
    // #given
    const metadata = {
      [ACCESS_METADATA_KEY]: { allowed: ["a", 3, null], denied: "b" },
    };
    // #then
    expect(readAccessList(metadata)).toEqual({ allowed: ["a"], denied: [] });
  });
});

describe("accessDecision", () => {
  const list = { allowed: ["a"], denied: ["b"] };

  it("allows a source in allowed", () => {
    expect(accessDecision(list, "a")).toBe("allowed");
  });

  it("denies a source in denied", () => {
    expect(accessDecision(list, "b")).toBe("denied");
  });

  it("does not know a source in neither list", () => {
    expect(accessDecision(list, "c")).toBe("unknown");
  });

  it("denies a source that a race put in both lists", () => {
    expect(accessDecision({ allowed: ["a"], denied: ["a"] }, "a")).toBe("denied");
  });
});

describe("withDecision", () => {
  it("moves a denied source to allowed", () => {
    expect(withDecision({ allowed: [], denied: ["a"] }, "a", true)).toEqual({
      allowed: ["a"],
      denied: [],
    });
  });
});

describe("recording a GM's answer", () => {
  beforeEach(() => {
    resetObrCalls();
  });

  it("stores the first answer in room metadata", async () => {
    // #when
    await recordAccessDecision("com.example.a", true);
    // #then
    expect(obrConfig.roomMetadata[ACCESS_METADATA_KEY]).toEqual({
      allowed: ["com.example.a"],
      denied: [],
    });
  });

  it("keeps the first answer when a second GM answers differently", async () => {
    // #given
    await recordAccessDecision("com.example.a", false);
    // #when
    const result = await recordAccessDecision("com.example.a", true);
    // #then
    expect([result, obrConfig.roomMetadata[ACCESS_METADATA_KEY]]).toEqual([
      "denied",
      { allowed: [], denied: ["com.example.a"] },
    ]);
  });

  it("forgets an answer so the GM is asked again", async () => {
    // #given
    await recordAccessDecision("com.example.a", true);
    // #when
    await forgetAccessDecision("com.example.a");
    // #then
    expect(obrConfig.roomMetadata[ACCESS_METADATA_KEY]).toEqual({
      allowed: [],
      denied: [],
    });
  });
});
