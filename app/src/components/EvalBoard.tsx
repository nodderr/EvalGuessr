import { useMemo, useRef } from "react";
import type { Arrow } from "react-chessboard";
import { Board } from "./Board";
import { EvalBar, type BarMarker } from "./EvalBar";
import { MaterialBar } from "./MaterialBar";
import { materialOf } from "./material";
import { useWheelNudge } from "./useGuessKeys";

type Props = {
  fen: string;
  orientation: "white" | "black";
  guess: number;
  onGuess?: (pawns: number) => void;
  disabled?: boolean;
  reveal?: { evalPawns: number; markers: BarMarker[] };
  /** Scroll anywhere on the page adjusts the guess (match screen); otherwise only over the board. */
  wheelAnywhere?: boolean;
  arrows?: Arrow[];
};

/**
 * The board with chess.com-style material bars above and below it, and the
 * eval bar alongside it on the right (the same height as the board).
 *
 *   [ top side's bar    ]
 *   [ board             ] [eval]
 *   [ bottom side's bar ]
 */
export function EvalBoard({ fen, orientation, guess, onGuess, disabled, reveal, wheelAnywhere = false, arrows }: Props) {
  // Scroll to adjust the guess: over the board, or anywhere on the page.
  const ref = useRef<HTMLDivElement>(null);
  useWheelNudge(wheelAnywhere ? null : ref, { enabled: !disabled && !reveal, value: guess, orientation, onChange: onGuess });

  // Material follows the position on screen (it changes while stepping through the best line).
  const material = useMemo(() => materialOf(fen), [fen]);
  const toMove = fen.split(" ")[1] === "b" ? "black" : "white";
  const top = orientation === "white" ? "black" : "white";
  const bottom = orientation;

  return (
    // The eval handle is wider than the bar, so it overhangs into the gap and the page gutter.
    // Phones: 30px bar + 12px gap; sm and up: 40px bar + 16px gap (BOARD_COLUMN relies on 56px).
    <div
      ref={ref}
      className="grid grid-cols-[minmax(0,1fr)_30px] gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_40px] sm:gap-x-4"
    >
      <div className="col-start-1 row-start-1">
        <MaterialBar side={top} material={material[top]} toMove={toMove === top} />
      </div>
      <div className="col-start-1 row-start-2">
        <Board fen={fen} orientation={orientation} arrows={arrows} />
      </div>
      <div className="col-start-2 row-start-2">
        <EvalBar value={guess} onChange={onGuess} disabled={disabled} orientation={orientation} reveal={reveal} />
      </div>
      <div className="col-start-1 row-start-3">
        <MaterialBar side={bottom} material={material[bottom]} toMove={toMove === bottom} />
      </div>
    </div>
  );
}
