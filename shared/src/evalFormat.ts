/**
 * Helpers for eval values. All evals are pawns from White's perspective:
 * positive = White better, negative = Black better.
 */
import { EVAL_RANGE } from "./config";

export function cpToPawns(cp: number): number {
  return cp / 100;
}

/** Clamp to the slider range and round to 0.1 pawns, the slider's finest step. */
export function normalizeGuess(pawns: number): number {
  const clamped = Math.min(EVAL_RANGE.max, Math.max(EVAL_RANGE.min, pawns));
  // "+ 0" turns -0 into 0 so it formats as "0.0", not "-0.0".
  return Math.round(clamped * 10) / 10 + 0;
}

/** Format like an eval bar: "+1.4", "-0.3", "0.0". */
export function formatEval(pawns: number): string {
  const rounded = Math.round(pawns * 10) / 10 + 0;
  if (rounded === 0) return "0.0";
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}`;
}
