import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  obrCalls,
  resetObrCalls,
  resetStores,
  simulateBroadcast,
  flushPromises,
} from "../integration/setup";
import { useDiceRollStore } from "../dice/store";
import { GM_ROLL_REVEAL_CHANNEL } from "./gmRollReveal";

const POPOVER_ROLL_CHANNEL = "rodeo.owlbear.dice/popover-roll";
const ROLL_REQUEST = {
  rollId: "popover-dm-roll",
  playerId: "player-1",
  playerName: "Gandalf",
  rollTarget: "dm" as const,
  diceNotation: "1d6",
  showResults: true,
  timestamp: 0,
  source: "com.example.forge",
};
const TRANSFORM = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
};

function finishPopoverRoll(value: number): string {
  simulateBroadcast(POPOVER_ROLL_CHANNEL, ROLL_REQUEST);
  const [id] = Object.keys(useDiceRollStore.getState().rollValues);
  useDiceRollStore.getState().finishDieRoll(id, value, TRANSFORM);
  return id;
}

describe("Dice+ popover roll host", () => {
  let unmount: () => void = () => {};

  beforeEach(async () => {
    resetStores();
    resetObrCalls();
    const hostModule = "./dicePlusPopoverRollHost";
    const { mountDicePlusPopoverRollHost } = (await import(hostModule)) as {
      mountDicePlusPopoverRollHost: () => () => void;
    };
    unmount = mountDicePlusPopoverRollHost();
  });

  afterEach(() => {
    unmount();
  });

  it("reports a completed popover roll to the requesting Dice+ source", () => {
    // #given
    // The popover host is mounted by beforeEach.
    // #when
    finishPopoverRoll(4);

    // #then
    expect(obrCalls.broadcast.filter(
      (broadcast) => broadcast.channel === "com.example.forge/roll-result"
    ).map((broadcast) => broadcast.data)).toEqual([{
      rollId: "popover-dm-roll",
      playerId: "player-1",
      playerName: "Gandalf",
      rollTarget: "dm",
      result: {
        totalValue: 4,
        rollSummary: "4 = 4",
        groups: [{
          description: "1d6",
          diceType: "d6",
          dice: [{ value: 4, kept: true }],
          total: 4,
          isNegative: false,
        }],
      },
    }]);
  });

  it("publishes the hidden roll without its values in player metadata", () => {
    // #given
    // The popover host is mounted by beforeEach.
    // #when
    finishPopoverRoll(4);

    // #then
    const completedMetadata = obrCalls.playerSetMetadata
      .filter((metadata) => metadata["rodeo.owlbear.dice/roll"] != null)
      .at(-1);
    expect([
      completedMetadata?.["rodeo.owlbear.dice/roll"],
      completedMetadata?.["rodeo.owlbear.dice/rollValues"],
      completedMetadata?.["rodeo.owlbear.dice/rollThrows"],
      completedMetadata?.["rodeo.owlbear.dice/rollTransforms"],
    ]).toEqual([expect.objectContaining({ hidden: true }), undefined, undefined, undefined]);
  });

  it("reveals a completed dm roll to GM clients", () => {
    // #given
    // The popover host is mounted by beforeEach.
    // #when
    const dieId = finishPopoverRoll(4);

    // #then
    const remoteReveals = obrCalls.broadcast
      .filter((broadcast) => (
        broadcast.channel === GM_ROLL_REVEAL_CHANNEL &&
        broadcast.options?.destination === "REMOTE"
      ))
      .map((broadcast) => broadcast.data);
    expect(remoteReveals).toContainEqual(
      expect.objectContaining({ rollValues: { [dieId]: 4 } })
    );
  });

  it("records a completed popover roll in the session log", async () => {
    // #given
    // The popover host is mounted by beforeEach.
    // #when
    finishPopoverRoll(4);
    await flushPromises();

    // #then
    expect(obrCalls.sceneSetMetadata.find(
      (metadata) => metadata["com.dicex/roll-log/player-1"] !== undefined
    )).toEqual({
      "com.dicex/roll-log/player-1": {
        name: "Gandalf",
        rolls: [expect.objectContaining({ notation: "1d6", total: 4 })],
      },
    });
  });

  it("sends a completed hidden popover roll to its Rumble recipients", async () => {
    // #given
    // The popover host is mounted by beforeEach.
    // #when
    finishPopoverRoll(4);
    await flushPromises();

    // #then
    expect(obrCalls.broadcast.filter(
      (broadcast) => broadcast.channel === "RUMBLECHAT"
    ).map((broadcast) => (
      broadcast.data as { data: { targetId: string } }
    ).data.targetId).sort()).toEqual(["gm-1", "player-1"]);
  });
});
