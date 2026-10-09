/**
 * Non-linear scale for the eval bar, like chess.com's: the area near 0 gets
 * most of the bar, large evals are compressed toward the ends.
 *
 *   fraction = 0.5 + 0.5 * tanh(k * pawns) / tanh(k * max)
 *
 * The tanh(k * max) term stretches the curve so -max and +max land exactly on
 * the bar's ends, making the mapping a bijection on [-max, +max] <-> [0, 1].
 * "fraction" is the share of the bar that is white.
 */
import { EVAL_RANGE } from "./config";

/** Curve steepness. 0.2 gives ~10% of the bar per pawn around 0 and ~1% per pawn near 10. */
export const EVAL_BAR_K = 0.2;
const NORM = Math.tanh(EVAL_BAR_K * EVAL_RANGE.max);

export function evalToBarFraction(pawns: number): number {
  const p = Math.min(EVAL_RANGE.max, Math.max(EVAL_RANGE.min, pawns));
  return 0.5 + (0.5 * Math.tanh(EVAL_BAR_K * p)) / NORM;
}

export function barFractionToEval(fraction: number): number {
  const f = Math.min(1, Math.max(0, fraction));
  return Math.atanh((2 * f - 1) * NORM) / EVAL_BAR_K;
}
