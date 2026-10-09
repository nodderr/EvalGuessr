import { useMemo } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

type Props = {
  fen: string;
  /** Board is drawn from this side's point of view (the side to move). */
  orientation: "white" | "black";
};

/** Read-only board. Sizes itself to its container's width. */
export function Board({ fen, orientation }: Props) {
  // Validate through chess.js so a bad FEN fails loudly instead of drawing a broken board.
  const position = useMemo(() => new Chess(fen).fen(), [fen]);

  return (
    <div className="aspect-square w-full overflow-hidden rounded-md shadow-[0_8px_24px_-12px_rgb(30_40_20/0.45)]">
      <Chessboard
        options={{
          id: "eval-board",
          position,
          boardOrientation: orientation,
          allowDragging: false,
          allowDrawingArrows: false,
          showAnimations: false,
          lightSquareStyle: { backgroundColor: "var(--board-light)" },
          darkSquareStyle: { backgroundColor: "var(--board-dark)" },
          lightSquareNotationStyle: { color: "var(--board-dark)", fontWeight: 600 },
          darkSquareNotationStyle: { color: "var(--board-light)", fontWeight: 600 },
        }}
      />
    </div>
  );
}

/** "White to move" / "Black to move" with a swatch of that colour. */
export function ToMove({ side }: { side: "white" | "black" }) {
  return (
    <p className="flex items-center gap-2 text-sm font-medium">
      <span
        aria-hidden
        className={`size-3.5 rounded-full border border-ink/40 ${side === "white" ? "bg-[#f7f7f2]" : "bg-[#262522]"}`}
      />
      {side === "white" ? "White" : "Black"} to move
    </p>
  );
}
