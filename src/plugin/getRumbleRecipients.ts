import { HiddenAudience } from "../types/DiceRoll";

interface GetRumbleRecipientsInput {
  hidden: boolean;
  hiddenAudience?: HiddenAudience;
  playerName: string;
  playerObrId: string;
  playerRole: "GM" | "PLAYER";
  gmName: string;
  gmObrId: string;
}

export interface RumbleRecipient {
  target: string;
  targetId: string;
}

export function getRumbleRecipients(
  input: GetRumbleRecipientsInput
): RumbleRecipient[] {
  if (!input.hidden) {
    return [{ target: "Everyone", targetId: "0000" }];
  }
  if (input.hiddenAudience === "self") {
    return [{ target: input.playerName, targetId: input.playerObrId }];
  }
  if (input.playerRole === "GM") {
    return [{ target: input.gmName, targetId: input.gmObrId }];
  }
  const recipients: RumbleRecipient[] = [
    { target: input.playerName, targetId: input.playerObrId },
  ];
  if (input.gmObrId !== input.playerObrId) {
    recipients.push({ target: input.gmName, targetId: input.gmObrId });
  }
  return recipients;
}
