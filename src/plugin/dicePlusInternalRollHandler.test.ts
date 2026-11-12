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
} from "./dicePlusProtocol";

const popoverChannels = {
  ping: "rodeo.owlbear.dice/popover-ping",
  ready: "rodeo.owlbear.dice/popover-ready",
  roll: "rodeo.owlbear.dice/popover-roll",
};
const createPopoverRollHandler = createDicePlusInternalRollHandler as (
  channels: typeof popoverChannels
) => () => void;

describe("dicePlusInternalRollHandler", () => {
  let unsubscribe: () => void;

  beforeEach(() => {
    resetStores();
    resetObrCalls();
    clearPendingRollRequest();
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

  it("shows rollTarget=everyone from any source", async () => {
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

  it("does not make a GM's hidden toggle public via an everyone roll", async () => {
    useDiceControlsStore.setState({ diceHidden: true });

    simulateBroadcast(INTERNAL_ROLL_CHANNEL, {
      rollId: "r-7",
      playerId: "p-1",
      playerName: "Alice",
      rollTarget: "everyone",
      diceNotation: "1d20",
      showResults: true,
      timestamp: 0,
      source: "com.example.forge",
    });
    await flushPromises();

    expect(useDiceRollStore.getState().roll?.hidden).toBe(false);
    expect(useDiceControlsStore.getState().diceHidden).toBe(true);
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

    it("leaves an everyone roll visible with no audience", async () => {
      // #when
      simulateBroadcast(
        INTERNAL_ROLL_CHANNEL,
        request("everyone")
      );
      await flushPromises();
      // #then
      const roll = useDiceRollStore.getState().roll;
      expect([roll?.hidden, roll?.hiddenAudience]).toEqual([false, undefined]);
    });
  });

  it("a popover handler answers and rolls only on popover channels", async () => {
    // #given
    unsubscribe();
    unsubscribe = createPopoverRollHandler(popoverChannels);
    // #when
    simulateBroadcast(popoverChannels.ping, { nonce: "popover-1" });
    simulateBroadcast(popoverChannels.roll, {
      rollId: "popover-roll",
      playerId: "p-1",
      playerName: "Alice",
      rollTarget: "dm",
      diceNotation: "1d6",
      showResults: true,
      timestamp: 0,
      source: "com.example.forge",
    });
    await flushPromises();

    // #then
    expect([
      obrCalls.broadcast.map((broadcast) => broadcast.channel),
      useDiceRollStore.getState().roll?.hidden,
      useDiceRollStore.getState().roll?.hiddenAudience,
    ]).toEqual([[popoverChannels.ready], true, "gm"]);
  });

  it("the action handler ignores popover pings and rolls", async () => {
    // #given
    // The default action handler is mounted by beforeEach.
    // #when
    simulateBroadcast(popoverChannels.ping, { nonce: "popover-2" });
    simulateBroadcast(popoverChannels.roll, {
      rollId: "ignored-popover-roll",
      playerId: "p-1",
      playerName: "Alice",
      rollTarget: "everyone",
      diceNotation: "1d6",
      showResults: true,
      timestamp: 0,
      source: "com.example.forge",
    });
    await flushPromises();

    // #then
    expect([
      obrCalls.broadcast,
      useDiceRollStore.getState().roll,
      getPendingRollRequest(),
    ]).toEqual([[], null, null]);
  });
});
