import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  obrCalls,
  resetObrCalls,
  simulateBroadcast,
  flushPromises,
} from "./setup";
import { mountDicePlusBackgroundListeners } from "../plugin/dicePlusBackgroundListeners";
import { DICE_PLUS_IS_READY_CHANNEL } from "../plugin/dicePlusProtocol";

describe("Dice+ isReady", () => {
  let unsub: () => void;

  beforeEach(() => {
    resetObrCalls();
    unsub = mountDicePlusBackgroundListeners();
  });

  afterEach(() => unsub());

  it("responds with its rollIn feature on the same channel", async () => {
    simulateBroadcast(DICE_PLUS_IS_READY_CHANNEL, {
      requestId: "rq-9",
      timestamp: 100,
    });
    await flushPromises();

    const replies = obrCalls.broadcast.filter(
      (b) =>
        b.channel === DICE_PLUS_IS_READY_CHANNEL &&
        (b.data as any).ready === true
    );
    expect(replies).toHaveLength(1);
    const data = replies[0].data as any;
    expect([
      data.requestId,
      data.ready,
      typeof data.timestamp,
      data.features,
    ]).toEqual(["rq-9", true, "number", ["rollIn"]]);
  });

  it("does not loop on its own ready response", async () => {
    // First, the legitimate request.
    simulateBroadcast(DICE_PLUS_IS_READY_CHANNEL, { requestId: "rq-1", timestamp: 0 });
    await flushPromises();
    const before = obrCalls.broadcast.length;

    // Now simulate the response coming back through the same channel.
    simulateBroadcast(DICE_PLUS_IS_READY_CHANNEL, {
      requestId: "rq-1",
      ready: true,
      timestamp: 1,
    });
    await flushPromises();

    expect(obrCalls.broadcast.length).toBe(before);
  });
});
