import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createDie,
  flushPromises,
  obrConfig,
  resetObrCalls,
  simulateBroadcast,
} from "../integration/setup";
import { DiceRoll } from "../types/DiceRoll";
import {
  buildGmRollReveal,
  createGmRollRevealSubscription,
  GM_ROLL_REVEAL_CHANNEL,
  GmRollReveal,
  matchGmRollReveal,
  useGmRollRevealStore,
} from "./gmRollReveal";

const THROW = {
  position: { x: 0, y: 1, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  linearVelocity: { x: 1, y: 0, z: 0 },
  angularVelocity: { x: 0, y: 1, z: 0 },
};
const TRANSFORM = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
};

function hiddenRoll(audience?: "self" | "gm", ids = ["d-1", "d-2"]): DiceRoll {
  return {
    dice: ids.map((id) => createDie("D20", id)),
    hidden: true,
    hiddenAudience: audience,
  };
}

function snapshot(roll: DiceRoll | null) {
  return {
    roll,
    rollThrows: { "d-1": THROW, "d-2": THROW },
    rollValues: { "d-1": 17, "d-2": null },
    rollTransforms: { "d-1": TRANSFORM, "d-2": null },
  };
}

const REVEAL: GmRollReveal = {
  dieIds: ["d-1", "d-2"],
  rollThrows: { "d-1": THROW, "d-2": THROW },
  rollValues: { "d-1": 17, "d-2": null },
  rollTransforms: { "d-1": TRANSFORM, "d-2": null },
};

describe("buildGmRollReveal", () => {
  it("carries the throws, values and transforms of a GM-audience roll", () => {
    // #given
    const state = snapshot(hiddenRoll("gm"));
    // #when
    const reveal = buildGmRollReveal(state, null);
    // #then
    expect(reveal).toEqual(REVEAL);
  });

  it("reveals nothing for a self-only roll", () => {
    expect(buildGmRollReveal(snapshot(hiddenRoll("self")), null)).toBeNull();
  });

  it("reveals nothing for a classic hidden roll", () => {
    expect(buildGmRollReveal(snapshot(hiddenRoll()), null)).toBeNull();
  });

  it("reveals nothing for a visible roll", () => {
    // #given
    const visible = { ...hiddenRoll("gm"), hidden: false };
    // #then
    expect(buildGmRollReveal(snapshot(visible), null)).toBeNull();
  });

  it("reveals nothing when there is no roll", () => {
    expect(buildGmRollReveal(snapshot(null), null)).toBeNull();
  });
});

describe("matchGmRollReveal", () => {
  it("returns the reveal for the same GM-audience roll", () => {
    expect(matchGmRollReveal(REVEAL, hiddenRoll("gm"))).toBe(REVEAL);
  });

  it("drops a reveal left over from an earlier roll", () => {
    // #given
    const nextRoll = hiddenRoll("gm", ["d-3", "d-4"]);
    // #then
    expect(matchGmRollReveal(REVEAL, nextRoll)).toBeUndefined();
  });

  it("drops a reveal when the current roll is not for the GM", () => {
    expect(matchGmRollReveal(REVEAL, hiddenRoll("self"))).toBeUndefined();
  });
});

describe("createGmRollRevealSubscription", () => {
  let unsubscribe: () => void;

  beforeEach(() => {
    resetObrCalls();
    useGmRollRevealStore.setState({ reveals: {} });
    unsubscribe = createGmRollRevealSubscription();
  });

  afterEach(() => {
    unsubscribe();
  });

  it("keeps a reveal on a GM client under the sender's connection id", async () => {
    // #given
    obrConfig.playerRole = "GM";
    // #when
    simulateBroadcast(GM_ROLL_REVEAL_CHANNEL, REVEAL, "conn-alice");
    await flushPromises();
    // #then
    expect(useGmRollRevealStore.getState().reveals).toEqual({
      "conn-alice": REVEAL,
    });
  });

  it("drops a reveal on a player client", async () => {
    // #given
    obrConfig.playerRole = "PLAYER";
    // #when
    simulateBroadcast(GM_ROLL_REVEAL_CHANNEL, REVEAL, "conn-alice");
    await flushPromises();
    // #then
    expect(useGmRollRevealStore.getState().reveals).toEqual({});
  });

  it("drops a malformed reveal", async () => {
    // #given
    obrConfig.playerRole = "GM";
    // #when
    simulateBroadcast(GM_ROLL_REVEAL_CHANNEL, { dieIds: "d-1" }, "conn-alice");
    await flushPromises();
    // #then
    expect(useGmRollRevealStore.getState().reveals).toEqual({});
  });
});
