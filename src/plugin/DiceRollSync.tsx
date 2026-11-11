import { useEffect } from "react";
import { createDiceRollSyncSubscription } from "./diceRollSyncSubscription";

/** Sync the current dice roll to the plugin */
export function DiceRollSync() {
  useEffect(() => createDiceRollSyncSubscription(), []);
  return null;
}
