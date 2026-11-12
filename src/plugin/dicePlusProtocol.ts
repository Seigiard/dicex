import { HiddenAudience } from "../types/DiceRoll";

/** Dice+ broadcast channel constants and payload types.
 *  Reference: docs/superpowers/specs/2026-05-05-dice-plus-protocol-design.md
 */

export const DICE_PLUS_IS_READY_CHANNEL = "dice-plus/isReady";
export const DICE_PLUS_ROLL_REQUEST_CHANNEL = "dice-plus/roll-request";
export const DICE_PLUS_REQUEST_ACCESS_CHANNEL = "dice-plus/request-access";

/**
 * How long a roll request from a source without the GM's answer waits for
 * one, and how long a request-access call reports on the outcome.
 */
export const ACCESS_DECISION_TIMEOUT_MS = 25_000;

/** `error` of a roll-error when the GM has not allowed the source. */
export const ROLL_ERROR_NOT_PERMITTED = "not-permitted";
/** `error` of a roll-error when no GM is in the room to allow the source. */
export const ROLL_ERROR_NO_GM = "no-gm";

export const INTERNAL_PING_CHANNEL = "rodeo.owlbear.dice/internal-ping";
export const INTERNAL_READY_CHANNEL = "rodeo.owlbear.dice/internal-ready";
export const INTERNAL_ROLL_CHANNEL = "rodeo.owlbear.dice/internal-roll";

export function rollResultChannel(source: string): string {
  return `${source}/roll-result`;
}

export function rollErrorChannel(source: string): string {
  return `${source}/roll-error`;
}

export function accessChannel(source: string): string {
  return `${source}/access`;
}

export type RollTarget = "everyone" | "self" | "dm" | "gm_only";

export interface IsReadyRequest {
  requestId: string;
  timestamp: number;
  /** Requester's extension id. When present, the reply carries `permitted`. */
  source?: string;
}

export interface IsReadyResponse {
  requestId: string;
  ready: true;
  timestamp: number;
  /** Whether the GM allowed `source` to roll in this room. Only when the request named a source. */
  permitted?: boolean;
}

export interface AccessRequest {
  requestId: string;
  source: string;
}

/**
 * - "allowed" / "denied": the GM's stored answer for this room.
 * - "pending": a GM was asked; a second reply with the outcome follows.
 * - "no-gm": no GM is in the room, so nobody can allow the source.
 * - "timeout": no GM answered within ACCESS_DECISION_TIMEOUT_MS.
 */
export type AccessStatus = "allowed" | "denied" | "pending" | "no-gm" | "timeout";

export interface AccessResponse {
  requestId: string;
  status: AccessStatus;
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
 * Map a Dice+ request onto dicex's hidden flag. The caller states the
 * visibility: "everyone" is a public roll, every other target is hidden.
 */
export function resolveHidden(target: RollTarget): boolean {
  return target !== "everyone";
}

/** Narrow a hidden Dice+ roll to its audience. "everyone" is never hidden. */
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

export function isAccessRequest(data: unknown): data is AccessRequest {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return typeof d.requestId === "string" && typeof d.source === "string";
}

export function isIsReadyRequest(data: unknown): data is IsReadyRequest {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  // Reject our own outbound responses (which carry ready: true).
  if (d.ready === true) return false;
  return typeof d.requestId === "string";
}
