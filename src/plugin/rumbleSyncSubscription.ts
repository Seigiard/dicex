import OBR from "@owlbear-rodeo/sdk";
import { useDiceRollStore } from "../dice/store";
import { useDiceControlsStore } from "../controls/store";
import { getDieFromDice } from "../helpers/getDieFromDice";
import { buildDiceResults } from "../helpers/buildDiceResults";
import { formatRumbleMessage } from "./formatRumbleMessage";
import { getRumbleRecipients } from "./getRumbleRecipients";

const RUMBLE_CHANNEL = "RUMBLECHAT";

export function createRumbleSyncSubscription(): () => void {
  let prevFinished = false;
  let prevIds: string[] = [];

  return useDiceRollStore.subscribe((state) => {
    if (!state.roll) {
      prevFinished = false;
      prevIds = [];
      return;
    }

    const ids = getDieFromDice(state.roll).map((die) => die.id);
    if (
      ids.length !== prevIds.length ||
      !ids.every((id, i) => id === prevIds[i])
    ) {
      prevFinished = false;
    }
    prevIds = ids;

    const allFinished = Object.values(state.rollValues).every(
      (v) => v !== null
    );
    if (!allFinished || prevFinished) {
      return;
    }

    if (state.explosionWavesActive) {
      return;
    }
    prevFinished = true;

    const roll = state.roll;
    const values = state.rollValues as Record<string, number>;
    const controlsState = useDiceControlsStore.getState();

    const result = buildDiceResults({
      roll,
      rollValues: values,
      activeNotation: controlsState.activeNotation,
      activePresetName: controlsState.activePresetName,
      activeNotationComponents: controlsState.activeNotationComponents,
    });

    const hidden = roll.hidden ?? false;
    const playerObrId = OBR.player.id;

    Promise.all([
      OBR.player.getName(),
      OBR.player.getRole(),
      OBR.player.getColor(),
      OBR.party.getPlayers(),
    ]).then(([playerName, role, playerColor, players]) => {
      const message = formatRumbleMessage({
        playerName,
        dice: result.dice,
        total: result.total,
        advantage: result.advantage,
        presetName: result.presetName,
        notation: result.notation,
        hidden,
      });

      const gmPlayer = players.find((p: any) => p.role === "GM");
      const gmName = gmPlayer?.name ?? playerName;
      const gmObrId = gmPlayer?.id ?? playerObrId;

      const recipients = getRumbleRecipients({
        hidden,
        hiddenAudience: roll.hiddenAudience,
        playerName,
        playerObrId,
        playerRole: role,
        gmName,
        gmObrId,
      });

      for (const recipient of recipients) {
        const payload = {
          chatlog: message,
          sender: "Dicex",
          senderId: playerObrId,
          target: recipient.target,
          targetId: recipient.targetId,
          color: playerColor,
          messageId: crypto.randomUUID(),
        };
        OBR.broadcast.sendMessage(
          RUMBLE_CHANNEL,
          { channel: RUMBLE_CHANNEL, data: payload },
          { destination: "ALL" }
        );
      }
    });
  });
}
