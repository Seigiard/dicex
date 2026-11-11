import OBR from "@owlbear-rodeo/sdk";
import create from "zustand";
import { useEffect } from "react";

import { getDieFromDice } from "../helpers/getDieFromDice";
import { NotationComponent } from "../helpers/notationParser";
import { DiceRoll } from "../types/DiceRoll";
import { DiceThrow } from "../types/DiceThrow";
import { DiceTransform } from "../types/DiceTransform";
import { getPluginId } from "./getPluginId";

/**
 * Carries a GM-audience hidden roll to GM clients.
 *
 * A hidden roll publishes its dice in player metadata but not its throws or
 * values, so other clients cannot replay it. For `hiddenAudience: "gm"` the
 * roller also broadcasts those inputs here, and only GM clients keep them.
 * OBR broadcasts reach every client, so this hides the roll from other
 * players' trays, not from someone reading network traffic; the Rumble chat
 * message for hidden rolls works the same way.
 */
export const GM_ROLL_REVEAL_CHANNEL = getPluginId("gm-roll-reveal");

export interface GmRollReveal {
  /** Die ids of the roll, so a reveal is dropped once the roll changes. */
  dieIds: string[];
  rollThrows: Record<string, DiceThrow>;
  rollValues: Record<string, number | null>;
  rollTransforms: Record<string, DiceTransform | null>;
  notationComponents?: NotationComponent[];
}

interface RollSnapshot {
  roll: DiceRoll | null;
  rollThrows: Record<string, DiceThrow>;
  rollValues: Record<string, number | null>;
  rollTransforms: Record<string, DiceTransform | null>;
}

/** The reveal to broadcast for the local roll, or null if the GM must not see it. */
export function buildGmRollReveal(
  snapshot: RollSnapshot,
  notationComponents: NotationComponent[] | null | undefined
): GmRollReveal | null {
  const { roll } = snapshot;
  if (!roll?.hidden || roll.hiddenAudience !== "gm") return null;
  return {
    dieIds: getDieFromDice(roll).map((die) => die.id),
    rollThrows: snapshot.rollThrows,
    rollValues: snapshot.rollValues,
    rollTransforms: snapshot.rollTransforms,
    notationComponents: notationComponents ?? undefined,
  };
}

/** The reveal that belongs to the player's current roll, if any. */
export function matchGmRollReveal(
  reveal: GmRollReveal | undefined,
  roll: DiceRoll | undefined
): GmRollReveal | undefined {
  if (!reveal || !roll?.hidden || roll.hiddenAudience !== "gm") return;
  const ids = getDieFromDice(roll).map((die) => die.id);
  const sameRoll =
    ids.length === reveal.dieIds.length &&
    ids.every((id, i) => id === reveal.dieIds[i]);
  return sameRoll ? reveal : undefined;
}

interface GmRollRevealState {
  /** Latest reveal per sender connection id. */
  reveals: Record<string, GmRollReveal>;
  receive: (connectionId: string, reveal: GmRollReveal) => void;
}

export const useGmRollRevealStore = create<GmRollRevealState>((set) => ({
  reveals: {},
  receive: (connectionId, reveal) =>
    set((state) => ({ reveals: { ...state.reveals, [connectionId]: reveal } })),
}));

/**
 * Keep reveals that reach this client while the local player is a GM.
 * Reveals are keyed by the sender's connection id, which OBR sets, so one
 * client cannot pose as another player's roll.
 */
export function createGmRollRevealSubscription(): () => void {
  return OBR.broadcast.onMessage(GM_ROLL_REVEAL_CHANNEL, (event) => {
    if (!isGmRollReveal(event.data)) return;
    const reveal = event.data;
    const connectionId = event.connectionId;
    OBR.player
      .getRole()
      .then((role) => {
        if (role === "GM") {
          useGmRollRevealStore.getState().receive(connectionId, reveal);
        }
      })
      .catch(() => {
        // Without a role we cannot tell whether this client may see it.
      });
  });
}

export function useGmRollRevealSubscription(): void {
  useEffect(() => createGmRollRevealSubscription(), []);
}

function isGmRollReveal(data: unknown): data is GmRollReveal {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d.dieIds) &&
    d.dieIds.every((id) => typeof id === "string") &&
    isRecord(d.rollThrows) &&
    isRecord(d.rollValues) &&
    isRecord(d.rollTransforms)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
