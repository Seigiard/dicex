import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  obrCalls,
  obrConfig,
  resetObrCalls,
  resetStores,
  simulateBroadcast,
} from "./setup";
import { mountDicePlusBackgroundListeners } from "../plugin/dicePlusBackgroundListeners";
import OBR from "@owlbear-rodeo/sdk";
import {
  ACCESS_ASK_CHANNEL,
  ACCESS_METADATA_KEY,
  readAccessList,
  withDecision,
} from "../plugin/dicePlusAccess";
import {
  DICE_PLUS_IS_READY_CHANNEL,
  DICE_PLUS_REQUEST_ACCESS_CHANNEL,
  DICE_PLUS_ROLL_REQUEST_CHANNEL,
  RollRequest,
} from "../plugin/dicePlusProtocol";

const SOURCE = "com.example.caller";

function rollRequest(rollId = "r-1"): RollRequest {
  return {
    rollId,
    playerId: "player-1",
    playerName: "Alice",
    rollTarget: "everyone",
    diceNotation: "1d20",
    showResults: true,
    timestamp: 0,
    source: SOURCE,
  };
}

function messagesOn(channel: string): any[] {
  return obrCalls.broadcast
    .filter((b) => b.channel === channel)
    .map((b) => b.data);
}

function rollErrors(): string[] {
  return messagesOn(`${SOURCE}/roll-error`).map((e) => e.error);
}

function accessStatuses(): string[] {
  return messagesOn(`${SOURCE}/access`).map((m) => m.status);
}

async function settle(ms = 0): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

/** A GM's client elsewhere in the room writes its answer to room metadata. */
async function gmAnswers(source: string, allowed: boolean): Promise<void> {
  const list = readAccessList(await OBR.room.getMetadata());
  await OBR.room.setMetadata({
    [ACCESS_METADATA_KEY]: withDecision(list, source, allowed),
  });
}

function noGmInRoom(): void {
  obrConfig.playerRole = "PLAYER";
  obrConfig.partyPlayers = [];
}

describe("Dice+ access control", () => {
  let unsubscribe: () => void;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    resetStores();
    resetObrCalls();
    obrConfig.actionIsOpen = true;
    unsubscribe = mountDicePlusBackgroundListeners();
  });

  afterEach(() => {
    unsubscribe();
    vi.useRealTimers();
  });

  describe("roll-request", () => {
    it("rolls for a source the GM allowed", async () => {
      // #given
      await gmAnswers(SOURCE, true);
      // #when
      simulateBroadcast(DICE_PLUS_ROLL_REQUEST_CHANNEL, rollRequest());
      await settle();
      // #then
      expect(obrCalls.actionOpenCount).toBe(1);
    });

    it("refuses a source the GM denied with not-permitted", async () => {
      // #given
      await gmAnswers(SOURCE, false);
      // #when
      simulateBroadcast(DICE_PLUS_ROLL_REQUEST_CHANNEL, rollRequest());
      await settle();
      // #then
      expect([rollErrors(), obrCalls.actionOpenCount]).toEqual([
        ["not-permitted"],
        0,
      ]);
    });

    it("refuses an unknown source with no-gm when no GM is in the room", async () => {
      // #given
      noGmInRoom();
      // #when
      simulateBroadcast(DICE_PLUS_ROLL_REQUEST_CHANNEL, rollRequest());
      await settle();
      // #then
      expect([rollErrors(), messagesOn(ACCESS_ASK_CHANNEL)]).toEqual([
        ["no-gm"],
        [],
      ]);
    });

    it("asks the GM about an unknown source and holds the roll", async () => {
      // #when
      simulateBroadcast(DICE_PLUS_ROLL_REQUEST_CHANNEL, rollRequest());
      await settle();
      // #then
      expect([
        messagesOn(ACCESS_ASK_CHANNEL),
        obrCalls.actionOpenCount,
        rollErrors(),
      ]).toEqual([[{ source: SOURCE, playerName: "Alice" }], 0, []]);
    });

    it("sends the ask to every client, the roller's own included", async () => {
      // #when
      simulateBroadcast(DICE_PLUS_ROLL_REQUEST_CHANNEL, rollRequest());
      await settle();
      // #then
      const ask = obrCalls.broadcast.find((b) => b.channel === ACCESS_ASK_CHANNEL);
      expect(ask?.options).toEqual({ destination: "ALL" });
    });

    it("rolls once the GM allows the waiting source", async () => {
      // #given
      simulateBroadcast(DICE_PLUS_ROLL_REQUEST_CHANNEL, rollRequest());
      await settle();
      // #when
      await gmAnswers(SOURCE, true);
      await settle();
      // #then
      expect([obrCalls.actionOpenCount, rollErrors()]).toEqual([1, []]);
    });

    it("refuses the waiting roll with not-permitted when the GM denies", async () => {
      // #given
      simulateBroadcast(DICE_PLUS_ROLL_REQUEST_CHANNEL, rollRequest());
      await settle();
      // #when
      await gmAnswers(SOURCE, false);
      await settle();
      // #then
      expect([rollErrors(), obrCalls.actionOpenCount]).toEqual([
        ["not-permitted"],
        0,
      ]);
    });

    it("still waits just before 25 seconds", async () => {
      // #given
      simulateBroadcast(DICE_PLUS_ROLL_REQUEST_CHANNEL, rollRequest());
      await settle();
      // #when
      await settle(24_999);
      // #then
      expect(rollErrors()).toEqual([]);
    });

    it("refuses with not-permitted when no GM answers within 25 seconds", async () => {
      // #given
      simulateBroadcast(DICE_PLUS_ROLL_REQUEST_CHANNEL, rollRequest());
      await settle();
      // #when
      await settle(25_000);
      // #then
      expect([rollErrors(), obrCalls.actionOpenCount]).toEqual([
        ["not-permitted"],
        0,
      ]);
    });

    it("asks the GM once for two waiting rolls from one source", async () => {
      // #when
      simulateBroadcast(DICE_PLUS_ROLL_REQUEST_CHANNEL, rollRequest("r-1"));
      simulateBroadcast(DICE_PLUS_ROLL_REQUEST_CHANNEL, rollRequest("r-2"));
      await settle();
      // #then
      expect(messagesOn(ACCESS_ASK_CHANNEL)).toHaveLength(1);
    });

    it("asks when the roller is the only GM", async () => {
      // #given
      obrConfig.playerRole = "GM";
      obrConfig.partyPlayers = [];
      // #when
      simulateBroadcast(DICE_PLUS_ROLL_REQUEST_CHANNEL, rollRequest());
      await settle();
      // #then
      expect([messagesOn(ACCESS_ASK_CHANNEL).length, rollErrors()]).toEqual([
        1,
        [],
      ]);
    });
  });

  describe("request-access", () => {
    function requestAccess() {
      simulateBroadcast(DICE_PLUS_REQUEST_ACCESS_CHANNEL, {
        requestId: "a-1",
        source: SOURCE,
      });
    }

    it("answers allowed for an allowed source", async () => {
      // #given
      await gmAnswers(SOURCE, true);
      // #when
      requestAccess();
      await settle();
      // #then
      expect(messagesOn(`${SOURCE}/access`)).toEqual([
        { requestId: "a-1", status: "allowed" },
      ]);
    });

    it("answers denied for a denied source without asking the GM", async () => {
      // #given
      await gmAnswers(SOURCE, false);
      // #when
      requestAccess();
      await settle();
      // #then
      expect([accessStatuses(), messagesOn(ACCESS_ASK_CHANNEL)]).toEqual([
        ["denied"],
        [],
      ]);
    });

    it("answers no-gm when no GM is in the room", async () => {
      // #given
      noGmInRoom();
      // #when
      requestAccess();
      await settle();
      // #then
      expect(accessStatuses()).toEqual(["no-gm"]);
    });

    it("answers pending, then allowed once the GM allows", async () => {
      // #given
      requestAccess();
      await settle();
      // #when
      await gmAnswers(SOURCE, true);
      await settle();
      // #then
      expect(accessStatuses()).toEqual(["pending", "allowed"]);
    });

    it("answers pending, then denied once the GM denies", async () => {
      // #given
      requestAccess();
      await settle();
      // #when
      await gmAnswers(SOURCE, false);
      await settle();
      // #then
      expect(accessStatuses()).toEqual(["pending", "denied"]);
    });

    it("answers pending, then timeout when no GM answers within 25 seconds", async () => {
      // #given
      requestAccess();
      await settle();
      // #when
      await settle(25_000);
      // #then
      expect(accessStatuses()).toEqual(["pending", "timeout"]);
    });
  });

  describe("isReady", () => {
    function readyReplies(): any[] {
      return messagesOn(DICE_PLUS_IS_READY_CHANNEL).filter((m) => m.ready);
    }

    it("reports permitted: true for an allowed source", async () => {
      // #given
      await gmAnswers(SOURCE, true);
      // #when
      simulateBroadcast(DICE_PLUS_IS_READY_CHANNEL, {
        requestId: "q-1",
        timestamp: 0,
        source: SOURCE,
      });
      await settle();
      // #then
      expect([
        readyReplies()[0].permitted,
        readyReplies()[0].features,
      ]).toEqual([true, ["rollIn"]]);
    });

    it("reports permitted: false for a source the GM has not allowed", async () => {
      // #when
      simulateBroadcast(DICE_PLUS_IS_READY_CHANNEL, {
        requestId: "q-1",
        timestamp: 0,
        source: SOURCE,
      });
      await settle();
      // #then
      expect(readyReplies()[0].permitted).toBe(false);
    });

    it("keeps permitted absent and advertises rollIn without source", async () => {
      // #when
      simulateBroadcast(DICE_PLUS_IS_READY_CHANNEL, {
        requestId: "q-1",
        timestamp: 0,
      });
      await settle();
      // #then
      expect(Object.keys(readyReplies()[0]).sort()).toEqual([
        "features",
        "ready",
        "requestId",
        "timestamp",
      ]);
    });
  });
});
