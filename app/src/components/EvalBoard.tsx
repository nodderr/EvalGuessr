import { useRef } from "react";
import { Board } from "./Board";
import { useWheelNudge } from "./useGuessKeys";
import { EvalBar, type BarMarker } from "./EvalBar";

type Props = {
  fen: string;
  orientation: "white" | "black";
  guess: number;
  onGuess?: (pawns: number) => void;
  disabled?: boolean;
  reveal?: { evalPawns: number; markers: BarMarker[] };
  /** Scroll anywhere on the page adjusts the guess (match screen); otherwise only over the board. */
  wheelAnywhere?: boolean;
};

/** The board with the eval bar running alongside it on the right, the same height. */
export function EvalBoard({ fen, orientation, guess, onGuess, disabled, reveal, wheelAnywhere = false }: Props) {
  // Scroll to adjust the guess: over the board, or anywhere on the page.
  const ref = useRef<HTMLDivElement>(null);
  useWheelNudge(wheelAnywhere ? null : ref, { enabled: !disabled && !reveal, value: guess, orientation, onChange: onGuess });

  return (
    // The handle is wider than the bar, so it overhangs into the gap and the page gutter.
    // Phones: 30px bar + 12px gap; sm and up: 40px bar + 16px gap (BOARD_COLUMN relies on 56px).
    <div ref={ref} className="grid grid-cols-[minmax(0,1fr)_30px] gap-3 sm:grid-cols-[minmax(0,1fr)_40px] sm:gap-4">
      <Board fen={fen} orientation={orientation} />
      <EvalBar
        value={guess}
        onChange={onGuess}
        disabled={disabled}
        orientation={orientation}
        reveal={reveal}
      />
    </div>
  );
}
