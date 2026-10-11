import { memo } from "react";
import { defaultPieces } from "react-chessboard";
import { LINE_ARROW_COLOR } from "./line";

type Props = {
  fen: string;
  orientation: "white" | "black";
  /** One move to draw as an arrow, e.g. Stockfish's best move. */
  arrow?: { from: string; to: string };
};

/** Pieces by rank (8 down to 1) and file (a to h), e.g. "wP", or null for an empty square. */
function placement(fen: string): (string | null)[][] {
  return fen
    .split(" ")[0]!
    .split("/")
    .map((row) =>
      [...row].flatMap((ch) =>
        /\d/.test(ch) ? Array<null>(Number(ch)).fill(null) : [`${ch === ch.toUpperCase() ? "w" : "b"}${ch.toUpperCase()}`],
      ),
    );
}

/** Grid cell (column, row from the top) of a square like "e4", as seen from `orientation`. */
function cell(square: string, orientation: "white" | "black") {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return orientation === "white" ? { x: file, y: 7 - rank } : { x: 7 - file, y: rank };
}

/**
 * Small read-only board for lists of positions (the match summary). Much lighter
 * than the interactive Board: plain squares and the same piece set, no coordinates.
 */
export const MiniBoard = memo(function MiniBoard({ fen, orientation, arrow }: Props) {
  const board = placement(fen);
  const pieces = Array.from({ length: 64 }, (_, i) => {
    const [x, y] = [i % 8, Math.floor(i / 8)];
    return orientation === "white" ? board[y]?.[x] : board[7 - y]?.[7 - x];
  });

  return (
    <div
      className="relative grid aspect-square w-full grid-cols-8 overflow-hidden rounded-md"
      // The squares are one continuous background, so fractional square sizes never leave seams.
      // The top-left square is light from either side (a8 for White, h1 for Black).
      style={{
        background: "repeating-conic-gradient(var(--board-dark) 0 25%, var(--board-light) 0 50%) 0 0 / 25% 25%",
      }}
    >
      {pieces.map((piece, i) => (
        <div key={i}>
          {piece && defaultPieces[piece]?.({ svgStyle: { width: "100%", height: "100%", display: "block" } })}
        </div>
      ))}
      {arrow && <MoveArrow from={cell(arrow.from, orientation)} to={cell(arrow.to, orientation)} />}
    </div>
  );
});

/** chess.com-style analysis arrow between two squares, in board units (one square = 1). */
function MoveArrow({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  const [x1, y1, x2, y2] = [from.x + 0.5, from.y + 0.5, to.x + 0.5, to.y + 0.5];
  const len = Math.hypot(x2 - x1, y2 - y1);
  const [ux, uy] = [(x2 - x1) / len, (y2 - y1) / len];
  const head = 0.45;
  // The tip stops a little short of the target square's centre; the shaft ends inside the head.
  const tip = { x: x2 - ux * 0.1, y: y2 - uy * 0.1 };
  const base = { x: tip.x - ux * head, y: tip.y - uy * head };
  const [px, py] = [-uy * (head / 2), ux * (head / 2)];
  return (
    <svg viewBox="0 0 8 8" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
      <line x1={x1} y1={y1} x2={base.x + ux * 0.05} y2={base.y + uy * 0.05} stroke={LINE_ARROW_COLOR} strokeWidth={0.2} />
      <polygon
        points={`${tip.x},${tip.y} ${base.x + px},${base.y + py} ${base.x - px},${base.y - py}`}
        fill={LINE_ARROW_COLOR}
      />
    </svg>
  );
}
