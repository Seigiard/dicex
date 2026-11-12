import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  obrCalls,
  resetObrCalls,
  simulateBroadcast,
  flushPromises,
  allowDicePlusSource,
} from "../integration/setup";
import { mountDicePlusBackgroundListeners } from "./dicePlusBackgroundListeners";
import {
  DICE_PLUS_IS_READY_CHANNEL,
  DICE_PLUS_ROLL_REQUEST_CHANNEL,
  RollRequest,
} from "./dicePlusProtocol";

describe("Dice+ background listeners", () => {
  let unsubscribe: () => void;

  beforeEach(() => {
    resetObrCalls();
    allowDicePlusSource("com.example.forge");
    unsubscribe = mountDicePlusBackgroundListeners();
  });

  afterEach(() => {
    unsubscribe();
  });

  it("answers dice-plus/isReady on the same channel with ready: true", async () => {
    simulateBroadcast(DICE_PLUS_IS_READY_CHANNEL, {
      requestId: "rq-1",
      timestamp: 1000,
    });
    await flushPromises();

    const reply = obrCalls.broadcast.find(
      (b) =>
        b.channel === DICE_PLUS_IS_READY_CHANNEL &&
        (b.data as any).ready === true
    );
    expect(reply).toBeDefined();
    expect((reply!.data as any).requestId).toBe("rq-1");
    expect(typeof (reply!.data as any).timestamp).toBe("number");
  });

  it("emits {source}/roll-error and does not open the action when notation is invalid", async () => {
    const payload: RollRequest = {
      rollId: "roll-bad",
      playerId: "player-1",
      playerName: "Alice",
      rollTarget: "everyone",
      diceNotation: "ddd",
      showResults: true,
      timestamp: 0,
      source: "com.example.forge",
    };
    simulateBroadcast(DICE_PLUS_ROLL_REQUEST_CHANNEL, payload);
    await flushPromises();

    const err = obrCalls.broadcast.find(
      (b) => b.channel === "com.example.forge/roll-error"
    );
    expect(err).toBeDefined();
    expect((err!.data as any).rollId).toBe("roll-bad");
    expect((err!.data as any).notation).toBe("ddd");
    expect(typeof (err!.data as any).error).toBe("string");
    expect(obrCalls.actionOpenCount).toBe(0);
  });

  it("on valid notation, relays to a ready popover without opening the action", async () => {
    // #given
    const payload: RollRequest = {
      rollId: "roll-good",
      playerId: "player-1",
      playerName: "Alice",
      rollTarget: "everyone",
      diceNotation: "1d20",
      showResults: true,
      timestamp: 0,
      source: "com.example.forge",
    };
    // #when
    simulateBroadcast(DICE_PLUS_ROLL_REQUEST_CHANNEL, payload);
    await flushPromises();

    const ping = obrCalls.broadcast.find(
      (b) => b.channel === "rodeo.owlbear.dice/popover-ping"
    );
    expect(ping).toBeDefined();
    simulateBroadcast("rodeo.owlbear.dice/popover-ready", ping!.data);
    await flushPromises();

    // #then
    expect([
      obrCalls.actionOpenCount,
      obrCalls.broadcast.find(
        (b) => b.channel === "rodeo.owlbear.dice/popover-roll"
      )?.data,
    ]).toEqual([0, payload]);
  });

  it("ignores roll requests addressed to a different player", async () => {
    const payload: RollRequest = {
      rollId: "roll-other",
      playerId: "someone-else",
      playerName: "Bob",
      rollTarget: "everyone",
      diceNotation: "1d20",
      showResults: true,
      timestamp: 0,
      source: "com.example.forge",
    };
    simulateBroadcast(DICE_PLUS_ROLL_REQUEST_CHANNEL, payload);
    await flushPromises();

    expect(obrCalls.actionOpenCount).toBe(0);
    expect(
      obrCalls.broadcast.some(
        (b) => b.channel === "com.example.forge/roll-error"
      )
    ).toBe(false);
    expect(
      obrCalls.broadcast.some(
        (b) => b.channel === "rodeo.owlbear.dice/internal-ping"
      )
    ).toBe(false);
  });
});
