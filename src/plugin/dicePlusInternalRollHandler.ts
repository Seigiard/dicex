import OBR from "@owlbear-rodeo/sdk";
import { rollFromNotation } from "../helpers/rollFromNotation";
import {
  DicePlusRollChannels,
  INTERNAL_PING_CHANNEL,
  INTERNAL_READY_CHANNEL,
  INTERNAL_ROLL_CHANNEL,
  resolveHidden,
  resolveHiddenAudience,
  RollRequest,
} from "./dicePlusProtocol";
import { setPendingRollRequest } from "./dicePlusPendingRequest";

/**
 * Mount Dice+ ping and roll listeners on the given channel set. The action
 * sidebar's internal channels are used by default; the popover passes its own.
 * Returns an unsubscribe that tears down both channels.
 */
export function createDicePlusInternalRollHandler(
  channels: DicePlusRollChannels = {
    ping: INTERNAL_PING_CHANNEL,
    ready: INTERNAL_READY_CHANNEL,
    roll: INTERNAL_ROLL_CHANNEL,
  }
): () => void {
  const unsubPing = OBR.broadcast.onMessage(channels.ping, (event) => {
    OBR.broadcast.sendMessage(
      channels.ready,
      event.data,
      { destination: "LOCAL" }
    );
  });

  const unsubRoll = OBR.broadcast.onMessage(channels.roll, (event) => {
    const request = event.data as RollRequest;

    setPendingRollRequest({
      rollId: request.rollId,
      source: request.source,
      playerId: request.playerId,
      playerName: request.playerName,
      rollTarget: request.rollTarget,
    });

    // Pass hidden per-roll rather than through the control store: the tray's
    // toggle belongs to the user, and a Dice+ roll must not leave it changed.
    rollFromNotation(request.diceNotation, {
      hidden: resolveHidden(request.rollTarget),
      hiddenAudience: resolveHiddenAudience(request.rollTarget),
    });
  });

  return () => {
    unsubPing();
    unsubRoll();
  };
}
