import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  obrCalls,
  resetObrCalls,
  resetStores,
  simulateRoll,
} from "../integration/setup";
import { createDiceRollSyncSubscription } from "./diceRollSyncSubscription";
import { GM_ROLL_REVEAL_CHANNEL, GmRollReveal } from "./gmRollReveal";

function reveals() {
  return obrCalls.broadcast.filter((b) => b.channel === GM_ROLL_REVEAL_CHANNEL);
}

describe("diceRollSyncSubscription GM reveal", () => {
  let unsubscribe: () => void;

  beforeEach(() => {
    resetStores();
    resetObrCalls();
    unsubscribe = createDiceRollSyncSubscription();
  });

  afterEach(() => {
    unsubscribe();
  });

  it("sends the finished values of a GM-audience roll to remote clients", () => {
    // #given
    const roll = { dice: [{ type: "D20" as const, value: 17 }], hidden: true };
    // #when
    const [id] = simulateRoll({ ...roll, hiddenAudience: "gm" });
    // #then
    const last = reveals()[reveals().length - 1];
    expect([last.options, (last.data as GmRollReveal).rollValues]).toEqual([
      { destination: "REMOTE" },
      { [id]: 17 },
    ]);
  });

  it("sends nothing to GMs for a self-only roll", () => {
    // #when
    simulateRoll({
      dice: [{ type: "D20", value: 17 }],
      hidden: true,
      hiddenAudience: "self",
    });
    // #then
    expect(reveals()).toEqual([]);
  });

  it("sends nothing to GMs for a classic hidden roll", () => {
    // #when
    simulateRoll({ dice: [{ type: "D20", value: 17 }], hidden: true });
    // #then
    expect(reveals()).toEqual([]);
  });

  it("still keeps the values of a GM-audience roll out of player metadata", () => {
    // #when
    simulateRoll({
      dice: [{ type: "D20", value: 17 }],
      hidden: true,
      hiddenAudience: "gm",
    });
    // #then
    const last = obrCalls.playerSetMetadata[obrCalls.playerSetMetadata.length - 1];
    expect(last["rodeo.owlbear.dice/rollValues"]).toBeUndefined();
  });
});
