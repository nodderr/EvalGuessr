import { Chess } from "chess.js";

export type PieceKind = "p" | "n" | "b" | "r" | "q";

const START: Record<PieceKind, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const VALUE: Record<PieceKind, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
/** chess.com lists captured pieces pawns first, then knights, bishops, rooks, queens. */
const ORDER: PieceKind[] = ["p", "n", "b", "r", "q"];

export type SideMaterial = {
  /** Opponent pieces this side has captured, in display order (lowercase kinds). */
  captured: PieceKind[];
  /** Material lead in pawns (0 if not ahead), like chess.com's "+2". */
  advantage: number;
};

/**
 * Captured pieces and material balance for both sides, worked out from the
 * position alone (as chess.com does). Promotions are handled by treating a
 * piece beyond the starting count as a pawn that left the board.
 */
export function materialOf(fen: string): { white: SideMaterial; black: SideMaterial } {
  const counts = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  for (const row of new Chess(fen).board()) {
    for (const sq of row) {
      if (sq && sq.type !== "k") counts[sq.color][sq.type as PieceKind]++;
    }
  }

  const missing = (c: "w" | "b"): Record<PieceKind, number> => {
    const have = counts[c];
    // Extra pieces beyond the starting set came from promoted pawns.
    const promoted = ORDER.filter((k) => k !== "p").reduce((n, k) => n + Math.max(0, have[k] - START[k]), 0);
    return {
      p: Math.max(0, START.p - have.p - promoted),
      n: Math.max(0, START.n - have.n),
      b: Math.max(0, START.b - have.b),
      r: Math.max(0, START.r - have.r),
      q: Math.max(0, START.q - have.q),
    };
  };
  const list = (m: Record<PieceKind, number>) => ORDER.flatMap((k) => Array<PieceKind>(m[k]).fill(k));
  const total = (c: "w" | "b") => ORDER.reduce((s, k) => s + counts[c][k] * VALUE[k], 0);

  const diff = total("w") - total("b");
  return {
    // White's captures are Black's missing pieces, and vice versa.
    white: { captured: list(missing("b")), advantage: Math.max(0, diff) },
    black: { captured: list(missing("w")), advantage: Math.max(0, -diff) },
  };
}
