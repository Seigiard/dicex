import { Player } from "@owlbear-rodeo/sdk";
import { useEffect, useMemo, useRef } from "react";
import {
  buildDiceResults,
  ProcessedRollResult,
} from "../helpers/buildDiceResults";
import { NotationComponent } from "../helpers/notationParser";
import { DiceRoll } from "../types/DiceRoll";
import { DiceThrow } from "../types/DiceThrow";
import { DiceTransform } from "../types/DiceTransform";
import { getPluginId } from "./getPluginId";
import { matchGmRollReveal, useGmRollRevealStore } from "./gmRollReveal";

export function usePlayerDice(player?: Player) {
  const diceRoll = useMemo(() => {
    return player?.metadata[getPluginId("roll")] as DiceRoll | undefined;
  }, [player]);

  // On a GM client, a GM-audience hidden roll is replayed from the inputs
  // the roller broadcast, since player metadata leaves them out.
  const reveal = useGmRollRevealStore((state) =>
    player ? state.reveals[player.connectionId] : undefined
  );
  const gmReveal = useMemo(
    () => matchGmRollReveal(reveal, diceRoll),
    [reveal, diceRoll]
  );
  const revealedToGm = Boolean(gmReveal);

  const rollThrows = useMemo(() => {
    if (gmReveal) return gmReveal.rollThrows;
    return player?.metadata[getPluginId("rollThrows")] as
      | Record<string, DiceThrow>
      | undefined;
  }, [player, gmReveal]);

  const rollValues = useMemo(() => {
    if (gmReveal) return gmReveal.rollValues;
    return player?.metadata[getPluginId("rollValues")] as
      | Record<string, number | null>
      | undefined;
  }, [player, gmReveal]);

  const rollTransforms = useMemo(() => {
    if (gmReveal) return gmReveal.rollTransforms;
    return player?.metadata[getPluginId("rollTransforms")] as
      | Record<string, DiceTransform | null>
      | undefined;
  }, [player, gmReveal]);

  const rollNotationComponents = useMemo(() => {
    if (gmReveal) return gmReveal.notationComponents;
    return player?.metadata[getPluginId("rollNotationComponents")] as
      | NotationComponent[]
      | undefined;
  }, [player, gmReveal]);

  const finishedRollTransforms = useMemo(() => {
    if (!rollTransforms) {
      return undefined;
    }
    const values: Record<string, DiceTransform> = {};
    for (const [id, value] of Object.entries(rollTransforms)) {
      if (value !== null) {
        values[id] = value;
      }
    }
    return values;
  }, [rollTransforms]);

  const transformsRef = useRef<Record<string, DiceTransform | null> | null>(
    null
  );
  useEffect(() => {
    transformsRef.current = rollTransforms || null;
  }, [rollTransforms]);

  const finishedRollValues = useMemo(() => {
    if (!rollValues) {
      return undefined;
    }
    const values: Record<string, number> = {};
    for (const [id, value] of Object.entries(rollValues)) {
      if (value !== null) {
        values[id] = value;
      }
    }
    return values;
  }, [rollValues]);

  // Reproduce the roller's result locally from synced inputs. buildDiceResults
  // is the single result authority — its advanced path applies keep/drop/explode
  // (needs the synced notation components), its basic path handles plain rolls,
  // advantage/disadvantage, and D100 via getCombinedDiceValue.
  const result = useMemo<ProcessedRollResult | null>(() => {
    if (diceRoll && finishedRollValues) {
      return buildDiceResults({
        roll: diceRoll,
        rollValues: finishedRollValues,
        activeNotationComponents: rollNotationComponents,
      });
    }
    return null;
  }, [diceRoll, finishedRollValues, rollNotationComponents]);

  const finalValue = result?.total ?? null;

  const finishedRolling = useMemo(() => {
    if (!rollValues) {
      return false;
    }
    const values = Object.values(rollValues);
    if (values.length === 0) {
      return false;
    } else {
      return values.every((value) => value !== null);
    }
  }, [rollValues]);

  return {
    diceRoll,
    rollThrows,
    rollValues,
    rollTransforms,
    transformsRef,
    finishedRollTransforms,
    finalValue,
    result,
    finishedRollValues,
    finishedRolling,
    revealedToGm,
  };
}
