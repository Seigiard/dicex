import { describe, it, expect, beforeEach } from "vitest";
import {
  ConsentStorage,
  createMemoryStorage,
  createPublicRollConsentRecord,
  publicRollConsent,
  useDicePlusConsentStore,
} from "./dicePlusConsent";

const DEFAULT_TRUSTED = "com.abottchen.obr-forge-helper";

describe("createPublicRollConsentRecord", () => {
  let storage: ConsentStorage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it("allows a built-in trusted source without asking", () => {
    // #given
    const record = createPublicRollConsentRecord(storage);
    // #when
    const consent = record.get(DEFAULT_TRUSTED);
    // #then
    expect(consent).toBe("allowed");
  });

  it("reports an unknown source as unasked", () => {
    // #given
    const record = createPublicRollConsentRecord(storage);
    // #when
    const consent = record.get("com.example.unknown");
    // #then
    expect(consent).toBe("unasked");
  });

  it("reports an allowed source as allowed", () => {
    // #given
    const record = createPublicRollConsentRecord(storage);
    // #when
    record.remember("com.example.a", true);
    // #then
    expect(record.get("com.example.a")).toBe("allowed");
  });

  it("reports a denied source as denied", () => {
    // #given
    const record = createPublicRollConsentRecord(storage);
    // #when
    record.remember("com.example.a", false);
    // #then
    expect(record.get("com.example.a")).toBe("denied");
  });

  it("keeps answers for other sources when remembering a new one", () => {
    // #given
    const record = createPublicRollConsentRecord(storage);
    record.remember("com.example.a", true);
    // #when
    record.remember("com.example.b", false);
    // #then
    expect([record.get("com.example.a"), record.get("com.example.b")]).toEqual([
      "allowed",
      "denied",
    ]);
  });

  it("reads an answer back after a reload of the same browser storage", () => {
    // #given
    createPublicRollConsentRecord(storage).remember("com.example.a", true);
    // #when
    const reloaded = createPublicRollConsentRecord(storage);
    // #then
    expect(reloaded.get("com.example.a")).toBe("allowed");
  });

  it("treats corrupt stored data as unasked", () => {
    // #given
    storage.setItem("rodeo.owlbear.dice/dice-plus/public-roll-consent", "{oops");
    const record = createPublicRollConsentRecord(storage);
    // #when
    const consent = record.get("com.example.a");
    // #then
    expect(consent).toBe("unasked");
  });

  it("does not mistake Object.prototype names for stored answers", () => {
    // #given
    const record = createPublicRollConsentRecord(storage);
    // #when
    const consent = record.get("constructor");
    // #then
    expect(consent).toBe("unasked");
  });

  it("keeps the answer for the session when storage refuses writes", () => {
    // #given
    const refusing: ConsentStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    const record = createPublicRollConsentRecord(refusing);
    // #when
    record.remember("com.example.a", true);
    // #then
    expect(record.get("com.example.a")).toBe("allowed");
  });
});

describe("useDicePlusConsentStore", () => {
  beforeEach(() => {
    useDicePlusConsentStore.setState({ pending: [] });
  });

  it("queues each source once however often it asks", () => {
    // #given
    const { ask } = useDicePlusConsentStore.getState();
    // #when
    ask("com.example.store-a");
    ask("com.example.store-b");
    ask("com.example.store-a");
    // #then
    expect(useDicePlusConsentStore.getState().pending).toEqual([
      "com.example.store-a",
      "com.example.store-b",
    ]);
  });

  it("removes an answered source from the queue", () => {
    // #given
    const { ask, answer } = useDicePlusConsentStore.getState();
    ask("com.example.store-c");
    ask("com.example.store-d");
    // #when
    answer("com.example.store-c", true);
    // #then
    expect(useDicePlusConsentStore.getState().pending).toEqual([
      "com.example.store-d",
    ]);
  });

  it("remembers the answer for the next roll", () => {
    // #given
    const { ask, answer } = useDicePlusConsentStore.getState();
    ask("com.example.store-e");
    // #when
    answer("com.example.store-e", false);
    // #then
    expect(publicRollConsent.get("com.example.store-e")).toBe("denied");
  });
});
