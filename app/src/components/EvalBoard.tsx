import { Board } from "./Board";
import { EvalBar, type BarMarker } from "./EvalBar";

type Props = {
  fen: string;
  orientation: "white" | "black";
  guess: number;
  onGuess?: (pawns: number) => void;
  disabled?: boolean;
  reveal?: { evalPawns: number; markers: BarMarker[] };
};

/** The board with the eval bar running alongside it on the right, the same height. */
export function EvalBoard({ fen, orientation, guess, onGuess, disabled, reveal }: Props) {
  return (
    // The handle (60px) is wider than the bar, so it overhangs into the gap and the page gutter.
    <div className="grid grid-cols-[minmax(0,1fr)_36px] gap-4 sm:grid-cols-[minmax(0,1fr)_40px]">
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
