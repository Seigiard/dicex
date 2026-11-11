import { Dice } from "./Dice";

/**
 * The roll of a set of dice.
 * See `Dice` type for examples of usage
 */
export interface DiceRoll extends Dice {
  hidden?: boolean;
  /**
   * Who sees a hidden roll besides the roller. Ignored unless `hidden`.
   * - absent: the classic hidden roll; the roller sees the dice, and the
   *   roller and the GM get the chat message.
   * - "self": only the roller; the GM gets no chat message either.
   * - "gm": the GM also sees the dice and the result in their trays.
   */
  hiddenAudience?: HiddenAudience;
}

export type HiddenAudience = "self" | "gm";
