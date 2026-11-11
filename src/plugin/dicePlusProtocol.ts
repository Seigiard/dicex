import { HiddenAudience } from "../types/DiceRoll";

/** Dice+ broadcast channel constants and payload types.
 *  Reference: docs/superpowers/specs/2026-05-05-dice-plus-protocol-design.md
 */

export const DICE_PLUS_IS_READY_CHANNEL = "dice-plus/isReady";
export const DICE_PLUS_ROLL_REQUEST_CHANNEL = "dice-plus/roll-request";

export const INTERNAL_PING_CHANNEL = "rodeo.owlbear.dice/internal-ping";
export const INTERNAL_READY_CHANNEL = "rodeo.owlbear.dice/internal-ready";
export const INTERNAL_ROLL_CHANNEL = "rodeo.owlbear.dice/internal-roll";

export function rollResultChannel(source: string): string {
  return `${source}/roll-result`;
}

export function rollErrorChannel(source: string): string {
  return `${source}/roll-error`;
}

export type RollTarget = "everyone" | "self" | "dm" | "gm_only";

export interface IsReadyRequest {
  requestId: string;
  timestamp: number;
}

export interface IsReadyResponse {
  requestId: string;
  ready: true;
  timestamp: number;
}

export interface RollRequest {
  rollId: string;
  playerId: string;
  playerName: string;
  rollTarget: RollTarget;
  diceNotation: string;
  showResults: boolean;
  timestamp: number;
  /** Requester's extension id; used as the prefix for response channels. */
  source: string;
}

export interface DicePlusDie {
  value: number;
  kept: boolean;
}

export interface DicePlusGroup {
  description: string; // e.g. "2d20kh1"
  diceType: string;    // e.g. "d20"
  dice: DicePlusDie[];
  total: number;       // sum of kept dice only
  isNegative: boolean;
}

export interface DicePlusResult {
  totalValue: number;
  rollSummary: string; // e.g. "3 + 5 + 2 = 10"
  groups: DicePlusGroup[];
}

export interface RollResultMessage {
  rollId: string;
  playerId: string;
  playerName: string;
  rollTarget: RollTarget;
  result: DicePlusResult;
}

export interface RollErrorMessage {
  rollId: string;
  error: string;
  notation: string;
}

/**
 * Sources allowed to make a roll public without asking the player first.
 *
 * Any other source asking for `rollTarget: "everyone"` gets a hidden roll
 * until the local player allows it (see `dicePlusConsent.ts`). The failure
 * modes are asymmetric: a roll wrongly made public cannot be taken back,
 * while one wrongly hidden is a minor annoyance. Third-party Dice+ sends
 * "everyone" for rolls that should be private, so nothing is public by
 * default.
 */
export const TRUSTED_ROLL_TARGET_SOURCES: readonly string[] = [
  "com.abottchen.obr-forge-helper",
];

/** The local player's answer to "may this source show my rolls to everyone?". */
export type PublicRollConsent = "allowed" | "denied" | "unasked";

/**
 * Map a Dice+ request onto dicex's hidden flag. Only "everyone", and only
 * from a source the player allows, produces a visible roll.
 */
export function resolveHidden(
  target: RollTarget,
  consent: PublicRollConsent
): boolean {
  return target !== "everyone" || consent !== "allowed";
}

/**
 * Narrow a hidden Dice+ roll to its audience. "everyone" has none: when it
 * falls back to hidden, it is the classic hidden roll.
 */
export function resolveHiddenAudience(
  target: RollTarget
): HiddenAudience | undefined {
  switch (target) {
    case "self":
      return "self";
    case "dm":
    case "gm_only":
      return "gm";
    case "everyone":
      return undefined;
  }
}

export function isRollRequest(data: unknown): data is RollRequest {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.rollId === "string" &&
    typeof d.playerId === "string" &&
    typeof d.playerName === "string" &&
    typeof d.diceNotation === "string" &&
    typeof d.source === "string" &&
    (d.rollTarget === "everyone" ||
      d.rollTarget === "self" ||
      d.rollTarget === "dm" ||
      d.rollTarget === "gm_only")
  );
}

export function isIsReadyRequest(data: unknown): data is IsReadyRequest {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  // Reject our own outbound responses (which carry ready: true).
  if (d.ready === true) return false;
  return typeof d.requestId === "string";
}
