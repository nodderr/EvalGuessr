import type { PlayerRoundResult } from "@eval-guess/shared";

export type ResultMark = { label: string; tone: "good" | "warn" | "bad" };

/** Turn a round result into a short verdict. */
export function resultMark(r: PlayerRoundResult): ResultMark {
  if (r.guess === null) return { label: "Time out", tone: "bad" };
  if (r.perfect) return { label: "Perfect", tone: "good" };
  if (r.points >= 50) return { label: "Close", tone: "warn" };
  if (r.points > 0) return { label: "Off", tone: "bad" };
  return { label: "Miss", tone: "bad" };
}

export const TONE_CLASS: Record<ResultMark["tone"], string> = {
  good: "text-good",
  warn: "text-warn",
  bad: "text-bad",
};
