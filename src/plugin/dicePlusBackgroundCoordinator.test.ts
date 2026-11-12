import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  obrCalls,
  obrConfig,
  resetObrCalls,
  simulateBroadcast,
} from "../integration/setup";
import { relayRollRequest } from "./dicePlusBackgroundCoordinator";
import {
  INTERNAL_PING_CHANNEL,
  INTERNAL_READY_CHANNEL,
  INTERNAL_ROLL_CHANNEL,
  RollRequest,
} from "./dicePlusProtocol";

const POPOVER_PING_CHANNEL = "rodeo.owlbear.dice/popover-ping";
const POPOVER_READY_CHANNEL = "rodeo.owlbear.dice/popover-ready";
const POPOVER_ROLL_CHANNEL = "rodeo.owlbear.dice/popover-roll";

const samplePayload: RollRequest = {
  rollId: "r-1",
  playerId: "p-1",
  playerName: "Alice",
  rollTarget: "everyone",
  diceNotation: "1d20",
  showResults: true,
  timestamp: 0,
  source: "com.example.forge",
};

describe("relayRollRequest", () => {
  beforeEach(() => {
    resetObrCalls();
    obrConfig.actionIsOpen = false;
  });

  it("relays through the ready popover without opening the action", async () => {
    // #given
    const promise = relayRollRequest(samplePayload);
    // #when
    await Promise.resolve();
    await Promise.resolve();

    const ping = obrCalls.broadcast.find((b) => b.channel === POPOVER_PING_CHANNEL);
    expect(ping).toBeDefined();
    const nonce = (ping!.data as { nonce: string }).nonce;
    simulateBroadcast(POPOVER_READY_CHANNEL, { nonce });

    await promise;

    // #then
    const popoverRoll = obrCalls.broadcast.find(
      (b) => b.channel === POPOVER_ROLL_CHANNEL
    );
    const internalRoll = obrCalls.broadcast.find(
      (b) => b.channel === INTERNAL_ROLL_CHANNEL
    );
    expect([obrCalls.actionOpenCount, popoverRoll?.data, internalRoll]).toEqual([
      0,
      samplePayload,
      undefined,
    ]);
  });

  it("uses the existing internal route when the action is already open", async () => {
    // #given
    obrConfig.actionIsOpen = true;
    const promise = relayRollRequest(samplePayload);
    // #when
    await Promise.resolve();
    await Promise.resolve();

    const ping = obrCalls.broadcast.find((b) => b.channel === INTERNAL_PING_CHANNEL);
    expect(ping).toBeDefined();
    simulateBroadcast(INTERNAL_READY_CHANNEL, {
      nonce: (ping!.data as { nonce: string }).nonce,
    });
    await promise;

    // #then
    const internalRoll = obrCalls.broadcast.find(
      (b) => b.channel === INTERNAL_ROLL_CHANNEL
    );
    expect([obrCalls.actionOpenCount, internalRoll?.data, obrCalls.broadcast.some(
      (b) => b.channel === POPOVER_ROLL_CHANNEL
    )]).toEqual([1, samplePayload, false]);
  });

  it("sends the internal roll after the action handshake times out", async () => {
    // #given
    obrConfig.actionIsOpen = true;
    vi.useFakeTimers();
    try {
      const promise = relayRollRequest(samplePayload);
      // #when
      await vi.advanceTimersByTimeAsync(2100);
      await promise;

      // #then
      const internalRoll = obrCalls.broadcast.find(
        (b) => b.channel === INTERNAL_ROLL_CHANNEL
      );
      expect(internalRoll?.data).toEqual(samplePayload);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends the internal roll after silent popover and action handshakes", async () => {
    // #given
    vi.useFakeTimers();
    try {
      const promise = relayRollRequest(samplePayload);
      // #when
      await vi.advanceTimersByTimeAsync(4200);
      await promise;

      // #then
      const internalRoll = obrCalls.broadcast.find(
        (b) => b.channel === INTERNAL_ROLL_CHANNEL
      );
      const popoverRoll = obrCalls.broadcast.find(
        (b) => b.channel === POPOVER_ROLL_CHANNEL
      );
      expect([
        obrCalls.actionOpenCount,
        internalRoll?.data,
        popoverRoll,
      ]).toEqual([1, samplePayload, undefined]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("relayRollRequest rollIn", () => {
  beforeEach(() => {
    resetObrCalls();
    obrConfig.actionIsOpen = false;
  });

  it("keeps an unknown string rollIn on the action route when the action is open", async () => {
    // #given
    obrConfig.actionIsOpen = true;
    const payload = { ...samplePayload, rollIn: "sideways" } as RollRequest;
    const promise = relayRollRequest(payload);
    await Promise.resolve();
    await Promise.resolve();
    const ping = obrCalls.broadcast.find((b) => b.channel === INTERNAL_PING_CHANNEL);
    simulateBroadcast(INTERNAL_READY_CHANNEL, {
      nonce: (ping!.data as { nonce: string }).nonce,
    });

    // #when
    await promise;

    // #then
    expect([
      obrCalls.actionOpenCount,
      obrCalls.broadcast.find((b) => b.channel === INTERNAL_ROLL_CHANNEL)?.data,
      obrCalls.broadcast.some((b) => b.channel === POPOVER_PING_CHANNEL),
    ]).toEqual([1, payload, false]);
  });

  it("keeps a numeric rollIn on the ready popover route when the action is closed", async () => {
    // #given
    const payload = { ...samplePayload, rollIn: 7 } as RollRequest;
    const promise = relayRollRequest(payload);
    await Promise.resolve();
    await Promise.resolve();
    const ping = obrCalls.broadcast.find((b) => b.channel === POPOVER_PING_CHANNEL);
    simulateBroadcast(POPOVER_READY_CHANNEL, {
      nonce: (ping!.data as { nonce: string }).nonce,
    });

    // #when
    await promise;

    // #then
    expect([
      obrCalls.actionOpenCount,
      obrCalls.broadcast.find((b) => b.channel === POPOVER_ROLL_CHANNEL)?.data,
      obrCalls.broadcast.some((b) => b.channel === INTERNAL_PING_CHANNEL),
    ]).toEqual([0, payload, false]);
  });

  it("uses the action route for window rollIn when the action is closed", async () => {
    // #given
    vi.useFakeTimers();
    try {
      const payload = { ...samplePayload, rollIn: "window" } as RollRequest;
      const promise = relayRollRequest(payload);
      await Promise.resolve();
      await Promise.resolve();
      const initialPing = obrCalls.broadcast.find(
        (b) => b.channel === INTERNAL_PING_CHANNEL
      );
      if (initialPing) {
        simulateBroadcast(INTERNAL_READY_CHANNEL, {
          nonce: (initialPing.data as { nonce: string }).nonce,
        });
      }
      await vi.advanceTimersByTimeAsync(2100);
      const fallbackPing = obrCalls.broadcast.find(
        (b) => b.channel === INTERNAL_PING_CHANNEL
      );
      if (fallbackPing) {
        simulateBroadcast(INTERNAL_READY_CHANNEL, {
          nonce: (fallbackPing.data as { nonce: string }).nonce,
        });
      }

      // #when
      await promise;

      // #then
      expect([
        obrCalls.actionOpenCount,
        obrCalls.broadcast.find((b) => b.channel === INTERNAL_ROLL_CHANNEL)?.data,
        obrCalls.broadcast.some((b) => b.channel === POPOVER_PING_CHANNEL),
        obrCalls.broadcast.some((b) => b.channel === POPOVER_ROLL_CHANNEL),
      ]).toEqual([1, payload, false, false]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses the action route for window rollIn when the action is open", async () => {
    // #given
    obrConfig.actionIsOpen = true;
    const payload = { ...samplePayload, rollIn: "window" } as RollRequest;
    const promise = relayRollRequest(payload);
    await Promise.resolve();
    await Promise.resolve();
    const ping = obrCalls.broadcast.find((b) => b.channel === INTERNAL_PING_CHANNEL);
    simulateBroadcast(INTERNAL_READY_CHANNEL, {
      nonce: (ping!.data as { nonce: string }).nonce,
    });

    // #when
    await promise;

    // #then
    expect([
      obrCalls.actionOpenCount,
      obrCalls.broadcast.find((b) => b.channel === INTERNAL_ROLL_CHANNEL)?.data,
      obrCalls.broadcast.some((b) => b.channel === POPOVER_PING_CHANNEL),
    ]).toEqual([1, payload, false]);
  });

  it("uses the ready popover route for tray rollIn when the action is open", async () => {
    // #given
    vi.useFakeTimers();
    try {
      obrConfig.actionIsOpen = true;
      const payload = { ...samplePayload, rollIn: "tray" } as RollRequest;
      const promise = relayRollRequest(payload);
      await Promise.resolve();
      await Promise.resolve();
      const popoverPing = obrCalls.broadcast.find(
        (b) => b.channel === POPOVER_PING_CHANNEL
      );
      if (popoverPing) {
        simulateBroadcast(POPOVER_READY_CHANNEL, {
          nonce: (popoverPing.data as { nonce: string }).nonce,
        });
      }
      await vi.advanceTimersByTimeAsync(2100);

      // #when
      await promise;

      // #then
      expect([
        obrCalls.actionOpenCount,
        obrCalls.broadcast.find((b) => b.channel === POPOVER_ROLL_CHANNEL)?.data,
        obrCalls.broadcast.some((b) => b.channel === INTERNAL_PING_CHANNEL),
        obrCalls.broadcast.some((b) => b.channel === INTERNAL_ROLL_CHANNEL),
      ]).toEqual([0, payload, false, false]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back from a silent tray rollIn when the action is closed", async () => {
    // #given
    vi.useFakeTimers();
    try {
      const payload = { ...samplePayload, rollIn: "tray" } as RollRequest;
      const promise = relayRollRequest(payload);

      // #when
      await vi.advanceTimersByTimeAsync(4200);
      await promise;

      // #then
      expect([
        obrCalls.actionOpenCount,
        obrCalls.broadcast.find((b) => b.channel === INTERNAL_ROLL_CHANNEL)?.data,
        obrCalls.broadcast.some((b) => b.channel === POPOVER_PING_CHANNEL),
        obrCalls.broadcast.some((b) => b.channel === POPOVER_ROLL_CHANNEL),
      ]).toEqual([1, payload, true, false]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back from a silent tray rollIn when the action is open", async () => {
    // #given
    vi.useFakeTimers();
    try {
      obrConfig.actionIsOpen = true;
      const payload = { ...samplePayload, rollIn: "tray" } as RollRequest;
      const promise = relayRollRequest(payload);

      // #when
      await vi.advanceTimersByTimeAsync(4200);
      await promise;

      // #then
      expect([
        obrCalls.actionOpenCount,
        obrCalls.broadcast.find((b) => b.channel === INTERNAL_ROLL_CHANNEL)?.data,
        obrCalls.broadcast.some((b) => b.channel === POPOVER_PING_CHANNEL),
        obrCalls.broadcast.some((b) => b.channel === POPOVER_ROLL_CHANNEL),
      ]).toEqual([1, payload, true, false]);
    } finally {
      vi.useRealTimers();
    }
  });
});
