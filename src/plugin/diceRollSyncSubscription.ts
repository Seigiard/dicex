import OBR from "@owlbear-rodeo/sdk";
import { useDiceRollStore } from "../dice/store";
import { useDiceControlsStore } from "../controls/store";
import { getDieFromDice } from "../helpers/getDieFromDice";
import { getPluginId } from "./getPluginId";

/** Publish the local roll to player metadata. */
export function createDiceRollSyncSubscription(): () => void {
  let prevIds: string[] = [];
  return useDiceRollStore.subscribe((state) => {
    let changed = false;
    if (!state.roll) {
      changed = true;
      prevIds = [];
    } else {
      const ids = getDieFromDice(state.roll).map((die) => die.id);
      // Check array length for early change check
      if (prevIds.length !== ids.length) {
        changed = true;
      }
      // Check the ids have changed
      else if (!ids.every((id, index) => id === prevIds[index])) {
        changed = true;
      }
      // Check if we'e completed a roll
      else if (
        Object.values(state.rollValues).every((value) => value !== null)
      ) {
        changed = true;
      }
      prevIds = ids;
    }

    if (changed) {
      // Hide values if needed
      const throws = state.roll?.hidden ? undefined : state.rollThrows;
      const values = state.roll?.hidden ? undefined : state.rollValues;
      const transforms = state.roll?.hidden
        ? undefined
        : state.rollTransforms;
      // Notation components carry advanced (keep/drop/explode) semantics that
      // aren't encoded in the roll structure. Remote viewers need them to
      // reproduce the same total/dropped result via buildDiceResults. Omit
      // for hidden rolls (values are hidden anyway, and so the notation).
      const notationComponents = state.roll?.hidden
        ? undefined
        : useDiceControlsStore.getState().activeNotationComponents ??
          undefined;
      OBR.player.setMetadata({
        [getPluginId("roll")]: state.roll,
        [getPluginId("rollThrows")]: throws,
        [getPluginId("rollValues")]: values,
        [getPluginId("rollTransforms")]: transforms,
        [getPluginId("rollNotationComponents")]: notationComponents,
      });

    }
  });
}
