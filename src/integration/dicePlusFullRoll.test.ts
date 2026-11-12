import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  obrCalls,
  obrConfig,
  resetStores,
  resetObrCalls,
  simulateBroadcast,
  flushPromises,
  allowDicePlusSource,
} from "./setup";
import { mountDicePlusBackgroundListeners } from "../plugin/dicePlusBackgroundListeners";
import { createDicePlusInternalRollHandler } from "../plugin/dicePlusInternalRollHandler";
import { createDicePlusResultReporter } from "../plugin/dicePlusResultReporter";
import { clearPendingRollRequest } from "../plugin/dicePlusPendingRequest";
import {
  DICE_PLUS_ROLL_REQUEST_CHANNEL,
  INTERNAL_PING_CHANNEL,
  INTERNAL_READY_CHANNEL,
  INTERNAL_ROLL_CHANNEL,
  RollRequest,
} from "../plugin/dicePlusProtocol";
import { useDiceRollStore } from "../dice/store";

describe("Dice+ full external roll integration", () => {
  let unsubBg: () => void;
  let unsubInternal: () => void;
  let unsubReporter: () => void;

  beforeEach(() => {
    resetStores();
    resetObrCalls();
    obrConfig.actionIsOpen = true;
    allowDicePlusSource("com.example.forge");
    clearPendingRollRequest();
    unsubBg = mountDicePlusBackgroundListeners();
    unsubInternal = createDicePlusInternalRollHandler();
    unsubReporter = createDicePlusResultReporter();
  });

  afterEach(() => {
    unsubBg();
    unsubInternal();
    unsubReporter();
    clearPendingRollRequest();
  });

  it("inbound roll-request → action open → handshake → roll → roll-result", async () => {
    const payload: RollRequest = {
      rollId: "r-1",
      playerId: "player-1",
      playerName: "Alice",
      rollTarget: "everyone",
      diceNotation: "2d6+3",
      showResults: true,
      timestamp: 0,
      source: "com.example.forge",
    };

    simulateBroadcast(DICE_PLUS_ROLL_REQUEST_CHANNEL, payload);
    // Let the background open the action and send its ping.
    await flushPromises();

    expect(obrCalls.actionOpenCount).toBe(1);
    const ping = obrCalls.broadcast.find(
      (b) => b.channel === INTERNAL_PING_CHANNEL
    );
    expect(ping).toBeDefined();

    // The mock's sendMessage records the call but does NOT cross-deliver to
    // local onMessage listeners. The action-sidebar handler "responded" by
    // calling sendMessage on INTERNAL_READY_CHANNEL — we need to bridge that
    // to the coordinator's onMessage listener manually so the handshake
    // completes without timing out.
    const pingNonce = (ping!.data as { nonce: string }).nonce;
    simulateBroadcast(INTERNAL_READY_CHANNEL, { nonce: pingNonce });

    // Let the coordinator resolve and send internal-roll.
    await flushPromises();
    await flushPromises();

    // Same bridge for internal-roll: coordinator sent it via sendMessage,
    // which doesn't deliver locally. Manually deliver to the internal
    // handler subscribed via onMessage.
    const internalRoll = obrCalls.broadcast.find(
      (b) => b.channel === INTERNAL_ROLL_CHANNEL
    );
    expect(internalRoll).toBeDefined();
    simulateBroadcast(INTERNAL_ROLL_CHANNEL, internalRoll!.data);
    await flushPromises();

    // Roll started; finish the dice with chosen values.
    const rollState = useDiceRollStore.getState();
    expect(rollState.roll).not.toBeNull();
    const ids = Object.keys(rollState.rollValues);
    const dummy = {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    };
    rollState.finishDieRoll(ids[0], 4, dummy);
    rollState.finishDieRoll(ids[1], 5, dummy);
    await flushPromises();

    const result = obrCalls.broadcast.find(
      (b) => b.channel === "com.example.forge/roll-result"
    );
    expect(result).toBeDefined();
    const data = result!.data as {
      rollId: string;
      result: { totalValue: number; groups: unknown[] };
    };
    expect(data.rollId).toBe("r-1");
    expect(data.result.totalValue).toBe(12); // 4 + 5 + 3
    expect(data.result.groups).toHaveLength(2); // dice + mod
  });
});
