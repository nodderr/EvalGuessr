import { Chess } from "chess.js";

/** One move of Stockfish's line, ready to draw: the position before it and its arrow squares. */
export type LineStep = {
  san: string;
  /** "7." before a White move, "7..." before a Black move that starts the line, "" otherwise. */
  number: string;
  /** Position before this move (where the arrow is drawn). */
  fenBefore: string;
  from: string;
  to: string;
};

/**
 * Play a SAN line from `fen` and describe each move. Stops quietly at the
 * first move that doesn't parse, so bad data can't break the reveal.
 */
export function lineSteps(fen: string, sanLine: string[]): LineStep[] {
  const game = new Chess(fen);
  const steps: LineStep[] = [];
  for (const [i, san] of sanLine.entries()) {
    const fenBefore = game.fen();
    const white = game.turn() === "w";
    const moveNo = game.moveNumber();
    let move;
    try {
      move = game.move(san);
    } catch {
      break;
    }
    const number = white ? `${moveNo}.` : i === 0 ? `${moveNo}...` : "";
    steps.push({ san: move.san, number, fenBefore, from: move.from, to: move.to });
  }
  return steps;
}

/** Arrow colour for engine moves, like chess.com's analysis arrows. */
export const LINE_ARROW_COLOR = "rgba(255, 170, 0, 0.85)";
