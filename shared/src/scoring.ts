/**
 * Scoring: a pure function of (guess, Stockfish eval). No UI, browser, or Node
 * dependencies, so the server can import it for authoritative scoring.
 */
import { SCORING, type ScoringConfig } from "./config";

export type ScoreResult = {
  /** |guess - eval| in pawns. */
  gap: number;
  /** Whole-number points, 0..maxPoints. */
  points: number;
  /** True when the guess landed inside the perfect window. */
  perfect: boolean;
};

/**
 * Score a guess. Both values are in pawns from White's perspective.
 *
 * gap <= perfectWindow           -> maxPoints
 * perfectWindow < gap < zeroAt   -> falls linearly to 0
 * gap >= zeroAt                  -> 0
 */
export function scoreGuess(
  guessPawns: number,
  evalPawns: number,
  config: ScoringConfig = SCORING,
): ScoreResult {
  const gap = Math.abs(guessPawns - evalPawns);
  const { perfectWindow, zeroAt, maxPoints } = config;

  if (gap <= perfectWindow) {
    return { gap, points: maxPoints, perfect: true };
  }
  const fraction = 1 - (gap - perfectWindow) / (zeroAt - perfectWindow);
  // Points are rounded here so the totals players see always add up exactly.
  return { gap, points: Math.round(maxPoints * Math.max(0, fraction)), perfect: false };
}
