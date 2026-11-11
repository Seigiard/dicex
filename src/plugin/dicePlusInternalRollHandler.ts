import OBR from "@owlbear-rodeo/sdk";
import { rollFromNotation } from "../helpers/rollFromNotation";
import {
  INTERNAL_PING_CHANNEL,
  INTERNAL_READY_CHANNEL,
  INTERNAL_ROLL_CHANNEL,
  resolveHidden,
  resolveHiddenAudience,
  RollRequest,
} from "./dicePlusProtocol";
import { setPendingRollRequest } from "./dicePlusPendingRequest";

/**
 * Mount the action-sidebar-side Dice+ listeners.
 * Returns an unsubscribe that tears down both channels.
 */
export function createDicePlusInternalRollHandler(): () => void {
  const unsubPing = OBR.broadcast.onMessage(INTERNAL_PING_CHANNEL, (event) => {
    OBR.broadcast.sendMessage(
      INTERNAL_READY_CHANNEL,
      event.data,
      { destination: "LOCAL" }
    );
  });

  const unsubRoll = OBR.broadcast.onMessage(INTERNAL_ROLL_CHANNEL, (event) => {
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
      hidden: resolveHidden(request.source, request.rollTarget),
      hiddenAudience: resolveHiddenAudience(request.rollTarget),
    });
  });

  return () => {
    unsubPing();
    unsubRoll();
  };
}
