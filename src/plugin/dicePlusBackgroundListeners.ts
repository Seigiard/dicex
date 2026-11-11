import OBR from "@owlbear-rodeo/sdk";
import { parseNotation, NotationError } from "../helpers/notationParser";
import {
  ACCESS_DECISION_TIMEOUT_MS,
  AccessResponse,
  AccessStatus,
  DICE_PLUS_IS_READY_CHANNEL,
  DICE_PLUS_REQUEST_ACCESS_CHANNEL,
  DICE_PLUS_ROLL_REQUEST_CHANNEL,
  IsReadyResponse,
  ROLL_ERROR_NO_GM,
  ROLL_ERROR_NOT_PERMITTED,
  RollErrorMessage,
  RollRequest,
  accessChannel,
  isAccessRequest,
  isIsReadyRequest,
  isRollRequest,
  rollErrorChannel,
} from "./dicePlusProtocol";
import { relayRollRequest } from "./dicePlusBackgroundCoordinator";
import {
  AskGmForAccess,
  createGmAccessAsker,
  getAccessDecision,
  isGmInRoom,
} from "./dicePlusAccess";

/** Mount the background-side Dice+ listeners. Returns an unsubscribe. */
export function mountDicePlusBackgroundListeners(): () => void {
  const askGm = createGmAccessAsker(ACCESS_DECISION_TIMEOUT_MS);

  const unsubReady = OBR.broadcast.onMessage(
    DICE_PLUS_IS_READY_CHANNEL,
    (event) => {
      if (!isIsReadyRequest(event.data)) return;
      const req = event.data;

      const reply = async () => {
        const response: IsReadyResponse = {
          requestId: req.requestId,
          ready: true,
          timestamp: Date.now(),
        };
        // Callers that predate access control send no source; their reply
        // keeps its old shape.
        if (typeof req.source === "string") {
          response.permitted =
            (await getAccessDecision(req.source)) === "allowed";
        }
        await OBR.broadcast.sendMessage(DICE_PLUS_IS_READY_CHANNEL, response, {
          destination: "LOCAL",
        });
      };
      reply().catch((e) => console.warn("Dice+ isReady reply failed", e));
    }
  );

  const unsubAccess = OBR.broadcast.onMessage(
    DICE_PLUS_REQUEST_ACCESS_CHANNEL,
    (event) => {
      if (!isAccessRequest(event.data)) return;
      const { requestId, source } = event.data;
      const send = (status: AccessStatus) => {
        const response: AccessResponse = { requestId, status };
        return OBR.broadcast.sendMessage(accessChannel(source), response, {
          destination: "LOCAL",
        });
      };

      const answer = async () => {
        const decision = await getAccessDecision(source);
        if (decision !== "unknown") return send(decision);
        if (!(await isGmInRoom())) return send("no-gm");
        await send("pending");
        const name = await OBR.player.getName();
        const outcome = await askGm(source, name);
        await send(outcome === "unknown" ? "timeout" : outcome);
      };
      answer().catch((e) => console.warn("Dice+ access request failed", e));
    }
  );

  const unsubRoll = OBR.broadcast.onMessage(
    DICE_PLUS_ROLL_REQUEST_CHANNEL,
    (event) => {
      if (!isRollRequest(event.data)) return;
      const payload = event.data;

      // Only the addressed player should react. Without this gate every
      // connected dicex client relays the roll into its own action sidebar,
      // leaving stuck rolls on inactive tabs (rollValues frozen at null).
      if (payload.playerId !== OBR.player.id) return;

      try {
        parseNotation(payload.diceNotation);
      } catch (e) {
        const message =
          e instanceof NotationError ? e.message : "Failed to parse notation";
        sendRollError(payload, message);
        return;
      }

      checkRollAccess(payload, askGm)
        .then((refusal) => {
          if (refusal) {
            sendRollError(payload, refusal);
            return;
          }
          return relayRollRequest(payload);
        })
        .catch((e) => {
          const message =
            e instanceof Error ? e.message : "Internal relay failure";
          sendRollError(payload, message);
        });
    }
  );

  return () => {
    unsubReady();
    unsubAccess();
    unsubRoll();
  };
}

/**
 * Null if the source may roll in this room, else the roll-error to send.
 * A source the GM has not answered for waits for a GM's answer.
 */
async function checkRollAccess(
  payload: RollRequest,
  askGm: AskGmForAccess
): Promise<string | null> {
  const decision = await getAccessDecision(payload.source);
  if (decision === "allowed") return null;
  if (decision === "denied") return ROLL_ERROR_NOT_PERMITTED;
  if (!(await isGmInRoom())) return ROLL_ERROR_NO_GM;
  const outcome = await askGm(payload.source, payload.playerName);
  return outcome === "allowed" ? null : ROLL_ERROR_NOT_PERMITTED;
}

function sendRollError(payload: RollRequest, message: string): void {
  const error: RollErrorMessage = {
    rollId: payload.rollId,
    error: message,
    notation: payload.diceNotation,
  };
  OBR.broadcast
    .sendMessage(rollErrorChannel(payload.source), error, {
      destination: "LOCAL",
    })
    .catch((e) => console.warn("Dice+ roll-error failed", e));
}
