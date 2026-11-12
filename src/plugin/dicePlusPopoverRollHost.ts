import { createDicePlusResultReporter } from "./dicePlusResultReporter";
import { createDicePlusInternalRollHandler } from "./dicePlusInternalRollHandler";
import { createDiceRollSyncSubscription } from "./diceRollSyncSubscription";
import { createRollLoggerSubscription } from "./rollLoggerSubscription";
import { createRumbleSyncSubscription } from "./rumbleSyncSubscription";
import {
  POPOVER_PING_CHANNEL,
  POPOVER_READY_CHANNEL,
  POPOVER_ROLL_CHANNEL,
} from "./dicePlusProtocol";

const POPOVER_CHANNELS = {
  ping: POPOVER_PING_CHANNEL,
  ready: POPOVER_READY_CHANNEL,
  roll: POPOVER_ROLL_CHANNEL,
} as const;

export function mountDicePlusPopoverRollHost(): () => void {
  const unmountHandler = createDicePlusInternalRollHandler(POPOVER_CHANNELS);
  const unmountReporter = createDicePlusResultReporter();
  const unmountRollSync = createDiceRollSyncSubscription();
  const unmountLogger = createRollLoggerSubscription();
  const unmountRumbleSync = createRumbleSyncSubscription();

  return () => {
    unmountRumbleSync();
    unmountLogger();
    unmountRollSync();
    unmountReporter();
    unmountHandler();
  };
}
