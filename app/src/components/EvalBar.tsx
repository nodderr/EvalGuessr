import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import {
  EVAL_RANGE,
  barFractionToEval,
  evalToBarFraction,
  formatEval,
  normalizeGuess,
} from "@eval-guess/shared";
import { nudge } from "./useGuessKeys";

export type BarMarker = {
  key: string;
  /** A player's guess in pawns. */
  value: number;
  /** True for the viewing player (green); opponents are red. */
  self: boolean;
};

type Props = {
  /** The guess in pawns, White's perspective. */
  value: number;
  onChange?: (pawns: number) => void;
  disabled?: boolean;
  /** Matches the board: White's part of the bar sits on White's side. */
  orientation: "white" | "black";
  /** After a reveal: the bar shows Stockfish's eval and marks each guess. */
  reveal?: { evalPawns: number; markers: BarMarker[] };
};

const HANDLE_H = 34; // px
const HALF = HANDLE_H / 2;

/**
 * Distance of a bar fraction from White's end. The usable travel is inset by
 * half the handle so the handle never leaves the bar.
 */
const along = (f: number) => `calc(${HALF}px + ${f} * (100% - ${HANDLE_H}px))`;

/**
 * Vertical eval bar, styled after chess.com's: white fills from White's side,
 * black from Black's, and dragging the handle moves the split. The handle's
 * position maps to pawns through the non-linear scale in shared/evalScale.ts.
 */
export function EvalBar({ value, onChange, disabled, orientation, reveal }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const interactive = !reveal && !disabled && !!onChange;
  const shown = reveal ? reveal.evalPawns : value;
  const f = evalToBarFraction(shown);
  // White's end is the bottom when the board shows White at the bottom.
  const whiteEdge = orientation === "white" ? "bottom" : "top";

  const setFromPointer = (clientY: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || !onChange) return;
    const t = Math.min(1, Math.max(0, (clientY - rect.top - HALF) / (rect.height - HANDLE_H)));
    const fraction = orientation === "white" ? 1 - t : t;
    onChange(normalizeGuess(barFractionToEval(fraction)));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    e.currentTarget.setPointerCapture(e.pointerId); // keep tracking outside the bar
    e.currentTarget.focus();
    setFromPointer(e.clientY);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (interactive && e.currentTarget.hasPointerCapture(e.pointerId)) setFromPointer(e.clientY);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || !onChange) return;
    const next = nudge(e.key, e.shiftKey, value, orientation);
    if (next !== null) {
      e.preventDefault();
      onChange(next);
    }
  };

  return (
    <div
      ref={barRef}
      role="slider"
      tabIndex={interactive ? 0 : -1}
      aria-label="Your eval guess"
      aria-orientation="vertical"
      aria-valuemin={EVAL_RANGE.min}
      aria-valuemax={EVAL_RANGE.max}
      aria-valuenow={value}
      aria-valuetext={formatEval(value)}
      aria-disabled={!interactive || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
      className={`relative h-full touch-none rounded-[4px] outline-none select-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
        interactive ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      {/* Black base with the white share filled from White's end. */}
      <div className="absolute inset-0 overflow-hidden rounded-[4px] bg-[#403d39] ring-1 ring-black/25 dark:ring-white/15">
        <div
          className={`absolute inset-x-0 bg-[#f2f2ee] ${reveal ? "transition-[height] duration-700 ease-out" : ""}`}
          style={{ [whiteEdge]: 0, height: along(f) }}
        />
        {reveal && <StockfishLabel evalPawns={reveal.evalPawns} whiteEdge={whiteEdge} />}
      </div>

      {/* Guess markers after the reveal. */}
      {reveal?.markers.map((m) => (
        <div
          key={m.key}
          aria-hidden
          className={`absolute -inset-x-2 h-1.5 rounded-full shadow-[0_0_0_1.5px_var(--surface)] ${m.self ? "bg-you" : "bg-opponent"}`}
          style={{ [whiteEdge]: along(evalToBarFraction(m.value)), transform: `translateY(${whiteEdge === "bottom" ? "50%" : "-50%"})` }}
        />
      ))}

      {/* Draggable handle showing the live guess. */}
      {!reveal && (
        <div
          aria-hidden
          className={`absolute left-1/2 grid w-[54px] place-items-center rounded-lg font-mono text-[14px] sm:w-[60px] sm:text-[15px] font-bold tabular-nums shadow-[0_2px_8px_rgb(0_0_0/0.35)] ${
            disabled ? "bg-ink-muted text-surface" : "bg-accent text-accent-ink"
          }`}
          style={{
            height: HANDLE_H,
            [whiteEdge]: along(f),
            transform: `translate(-50%, ${whiteEdge === "bottom" ? "50%" : "-50%"})`,
          }}
        >
          {formatEval(value)}
        </div>
      )}
    </div>
  );
}

/** Stockfish's number at the winning side's end of the bar, as on chess.com. */
function StockfishLabel({ evalPawns, whiteEdge }: { evalPawns: number; whiteEdge: "top" | "bottom" }) {
  const whiteBetter = evalPawns >= 0;
  const blackEdge = whiteEdge === "bottom" ? "top" : "bottom";
  return (
    <span
      className={`absolute inset-x-0 text-center font-mono text-[13px] font-bold tabular-nums ${whiteBetter ? "text-[#403d39]" : "text-[#f2f2ee]"}`}
      style={{ [whiteBetter ? whiteEdge : blackEdge]: 6 }}
    >
      {formatEval(Math.abs(evalPawns)).replace("+", "")}
    </span>
  );
}
