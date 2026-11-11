import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  obrCalls,
  resetStores,
  resetObrCalls,
  simulateBroadcast,
  flushPromises,
} from "../integration/setup";
import { useDiceControlsStore } from "../controls/store";
import { useDiceRollStore } from "../dice/store";
import { createDicePlusInternalRollHandler } from "./dicePlusInternalRollHandler";
import {
  getPendingRollRequest,
  clearPendingRollRequest,
} from "./dicePlusPendingRequest";
import {
  INTERNAL_PING_CHANNEL,
  INTERNAL_READY_CHANNEL,
  INTERNAL_ROLL_CHANNEL,
  TRUSTED_ROLL_TARGET_SOURCES,
} from "./dicePlusProtocol";
import { useDicePlusConsentStore } from "./dicePlusConsent";

function rollRequest(source: string, rollTarget: string, rollId = "r-c") {
  return {
    rollId,
    playerId: "p-1",
    playerName: "Alice",
    rollTarget,
    diceNotation: "1d20",
    showResults: true,
    timestamp: 0,
    source,
  };
}

describe("dicePlusInternalRollHandler", () => {
  let unsubscribe: () => void;

  beforeEach(() => {
    resetStores();
    resetObrCalls();
    clearPendingRollRequest();
    useDicePlusConsentStore.setState({ pending: [] });
    unsubscribe = createDicePlusInternalRollHandler();
  });

  afterEach(() => {
    unsubscribe();
    clearPendingRollRequest();
  });

  it("responds to internal-ping with internal-ready", () => {
    simulateBroadcast(INTERNAL_PING_CHANNEL, { nonce: "abc" });

    const reply = obrCalls.broadcast.find(
      (b) => b.channel === INTERNAL_READY_CHANNEL
    );
    expect(reply).toBeDefined();
    expect((reply!.data as any).nonce).toBe("abc");
  });

  it("on internal-roll: stores pending request, sets hidden from rollTarget, starts roll", async () => {
    simulateBroadcast(INTERNAL_ROLL_CHANNEL, {
      rollId: "r-1",
      playerId: "p-1",
      playerName: "Alice",
      rollTarget: "self",
      diceNotation: "1d20+3",
      showResults: true,
      timestamp: 0,
      source: "com.example.forge",
    });
    await flushPromises();

    const pending = getPendingRollRequest();
    expect(pending).toEqual({
      rollId: "r-1",
      playerId: "p-1",
      playerName: "Alice",
      rollTarget: "self",
      source: "com.example.forge",
    });

    expect(useDiceControlsStore.getState().activeNotation).toBe("1d20+3");

    const rollState = useDiceRollStore.getState();
    expect(rollState.roll).not.toBeNull();
    expect(rollState.roll?.hidden).toBe(true);
  });

  it("hides rollTarget=everyone from an untrusted source", async () => {
    simulateBroadcast(INTERNAL_ROLL_CHANNEL, {
      rollId: "r-2",
      playerId: "p-1",
      playerName: "Alice",
      rollTarget: "everyone",
      diceNotation: "1d6",
      showResults: true,
      timestamp: 0,
      source: "com.example.forge",
    });
    await flushPromises();

    expect(useDiceRollStore.getState().roll?.hidden).toBe(true);
  });

  it("honors rollTarget=everyone from a trusted source", async () => {
    simulateBroadcast(INTERNAL_ROLL_CHANNEL, {
      rollId: "r-5",
      playerId: "p-1",
      playerName: "Alice",
      rollTarget: "everyone",
      diceNotation: "1d20",
      showResults: true,
      timestamp: 0,
      source: TRUSTED_ROLL_TARGET_SOURCES[0],
    });
    await flushPromises();

    expect(useDiceRollStore.getState().roll?.hidden).toBe(false);
  });

  it("rollTarget=dm produces a hidden roll", async () => {
    simulateBroadcast(INTERNAL_ROLL_CHANNEL, {
      rollId: "r-3",
      playerId: "p-1",
      playerName: "Alice",
      rollTarget: "dm",
      diceNotation: "1d6",
      showResults: true,
      timestamp: 0,
      source: "com.example.forge",
    });
    await flushPromises();

    expect(useDiceRollStore.getState().roll?.hidden).toBe(true);
  });

  it("rollTarget=gm_only produces a hidden roll", async () => {
    simulateBroadcast(INTERNAL_ROLL_CHANNEL, {
      rollId: "r-4",
      playerId: "p-1",
      playerName: "Alice",
      rollTarget: "gm_only",
      diceNotation: "1d6",
      showResults: true,
      timestamp: 0,
      source: "com.example.forge",
    });
    await flushPromises();

    expect(useDiceRollStore.getState().roll?.hidden).toBe(true);
  });

  it("leaves the user's hidden toggle untouched", async () => {
    useDiceControlsStore.setState({ diceHidden: false });

    simulateBroadcast(INTERNAL_ROLL_CHANNEL, {
      rollId: "r-6",
      playerId: "p-1",
      playerName: "Alice",
      rollTarget: "gm_only",
      diceNotation: "1d6",
      showResults: true,
      timestamp: 0,
      source: "com.example.forge",
    });
    await flushPromises();

    expect(useDiceRollStore.getState().roll?.hidden).toBe(true);
    expect(useDiceControlsStore.getState().diceHidden).toBe(false);
  });

  it("does not make a GM's hidden toggle public via a trusted roll", async () => {
    useDiceControlsStore.setState({ diceHidden: true });

    simulateBroadcast(INTERNAL_ROLL_CHANNEL, {
      rollId: "r-7",
      playerId: "p-1",
      playerName: "Alice",
      rollTarget: "everyone",
      diceNotation: "1d20",
      showResults: true,
      timestamp: 0,
      source: TRUSTED_ROLL_TARGET_SOURCES[0],
    });
    await flushPromises();

    expect(useDiceRollStore.getState().roll?.hidden).toBe(false);
    expect(useDiceControlsStore.getState().diceHidden).toBe(true);
  });

  describe("public-roll consent", () => {
    it("asks the player when an unknown source wants rollTarget=everyone", async () => {
      // #given
      const source = "com.example.consent-ask";
      // #when
      simulateBroadcast(INTERNAL_ROLL_CHANNEL, rollRequest(source, "everyone"));
      await flushPromises();
      // #then
      expect(useDicePlusConsentStore.getState().pending).toEqual([source]);
    });

    it("shows the next roll after the player allows the source", async () => {
      // #given
      const source = "com.example.consent-allow";
      simulateBroadcast(INTERNAL_ROLL_CHANNEL, rollRequest(source, "everyone", "r-a1"));
      await flushPromises();
      useDicePlusConsentStore.getState().answer(source, true);
      // #when
      simulateBroadcast(INTERNAL_ROLL_CHANNEL, rollRequest(source, "everyone", "r-a2"));
      await flushPromises();
      // #then
      expect(useDiceRollStore.getState().roll?.hidden).toBe(false);
    });

    it("keeps rolls hidden after the player denies the source", async () => {
      // #given
      const source = "com.example.consent-deny";
      simulateBroadcast(INTERNAL_ROLL_CHANNEL, rollRequest(source, "everyone", "r-d1"));
      await flushPromises();
      useDicePlusConsentStore.getState().answer(source, false);
      // #when
      simulateBroadcast(INTERNAL_ROLL_CHANNEL, rollRequest(source, "everyone", "r-d2"));
      await flushPromises();
      // #then
      expect(useDiceRollStore.getState().roll?.hidden).toBe(true);
    });

    it("does not ask again after the player denies the source", async () => {
      // #given
      const source = "com.example.consent-deny-again";
      simulateBroadcast(INTERNAL_ROLL_CHANNEL, rollRequest(source, "everyone", "r-e1"));
      await flushPromises();
      useDicePlusConsentStore.getState().answer(source, false);
      // #when
      simulateBroadcast(INTERNAL_ROLL_CHANNEL, rollRequest(source, "everyone", "r-e2"));
      await flushPromises();
      // #then
      expect(useDicePlusConsentStore.getState().pending).toEqual([]);
    });

    it("does not ask for a built-in trusted source", async () => {
      // #given
      const source = TRUSTED_ROLL_TARGET_SOURCES[0];
      // #when
      simulateBroadcast(INTERNAL_ROLL_CHANNEL, rollRequest(source, "everyone"));
      await flushPromises();
      // #then
      expect(useDicePlusConsentStore.getState().pending).toEqual([]);
    });

    it("does not ask when the source requests a private target", async () => {
      // #given
      const source = "com.example.consent-private";
      // #when
      simulateBroadcast(INTERNAL_ROLL_CHANNEL, rollRequest(source, "self"));
      simulateBroadcast(INTERNAL_ROLL_CHANNEL, rollRequest(source, "dm"));
      simulateBroadcast(INTERNAL_ROLL_CHANNEL, rollRequest(source, "gm_only"));
      await flushPromises();
      // #then
      expect(useDicePlusConsentStore.getState().pending).toEqual([]);
      });
    });

  describe("hidden audience", () => {
    function request(rollTarget: string, source = "com.example.forge") {
      return {
        rollId: "r-aud",
        playerId: "p-1",
        playerName: "Alice",
        rollTarget,
        diceNotation: "1d20",
        showResults: true,
        timestamp: 0,
        source,
      };
    }

    it("narrows a self roll to the roller", async () => {
      // #when
      simulateBroadcast(INTERNAL_ROLL_CHANNEL, request("self"));
      await flushPromises();
      // #then
      expect(useDiceRollStore.getState().roll?.hiddenAudience).toBe("self");
    });

    it("opens a dm roll to the GM", async () => {
      // #when
      simulateBroadcast(INTERNAL_ROLL_CHANNEL, request("dm"));
      await flushPromises();
      // #then
      expect(useDiceRollStore.getState().roll?.hiddenAudience).toBe("gm");
    });

    it("opens a gm_only roll to the GM", async () => {
      // #when
      simulateBroadcast(INTERNAL_ROLL_CHANNEL, request("gm_only"));
      await flushPromises();
      // #then
      expect(useDiceRollStore.getState().roll?.hiddenAudience).toBe("gm");
    });

    it("leaves a trusted everyone roll visible with no audience", async () => {
      // #when
      simulateBroadcast(
        INTERNAL_ROLL_CHANNEL,
        request("everyone", TRUSTED_ROLL_TARGET_SOURCES[0])
      );
      await flushPromises();
      // #then
      const roll = useDiceRollStore.getState().roll;
      expect([roll?.hidden, roll?.hiddenAudience]).toEqual([false, undefined]);
    });
  });
});
