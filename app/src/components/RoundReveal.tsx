import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { formatEval, type MatchView, type RoundResult } from "@eval-guess/shared";
import type { LineStep } from "./line";
import { SourceBox } from "./SourceBox";
import { TONE_CLASS, resultMark } from "./resultMark";

type Props = {
  result: RoundResult;
  players: MatchView["players"];
  you: string;
  /** Stockfish's line, playable on the board. */
  line: LineStep[];
  /** Index of the move shown on the board (arrow drawn for it). */
  step: number;
  onStep: (index: number) => void;
};

/**
 * Stockfish's eval, one row per player, the best line and the source game.
 * Written for any number of players: practice shows one row, 1v1 shows two.
 */
export function RoundReveal({ result, players, you, line, step, onStep }: Props) {
  // Put the viewer first.
  const ordered = [...players].sort((a, b) => Number(b.id === you) - Number(a.id === you));

  return (
    <div className="grid gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink-muted">
          Stockfish <span className="text-xs">· depth {result.depth}</span>
        </span>
        <span className="font-mono text-4xl font-semibold tabular-nums">{formatEval(result.evalPawns)}</span>
      </div>

      <ul className="grid gap-2">
        {ordered.map((p) => {
          const r = result.byPlayer[p.id];
          if (!r) return null;
          const mark = resultMark(r);
          return (
            <li key={p.id} className="grid grid-cols-[1fr_auto] gap-x-3 rounded-lg border border-line px-3 py-2">
              <span className="flex items-center gap-2 font-medium">
                {/* Matches this player's marker on the eval bar. */}
                <span aria-hidden className={`h-1 w-4 rounded-full ${p.id === you ? "bg-you" : "bg-opponent"}`} />
                {p.id === you ? "You" : p.name}
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums">{r.points > 0 ? `+${r.points}` : "0"}</span>
              <span className="text-sm text-ink-muted">
                {r.guess === null ? "No guess" : `${formatEval(r.guess)}, off by ${r.gap!.toFixed(1)}`}
              </span>
              <span className={`text-sm font-semibold ${TONE_CLASS[mark.tone]}`}>{mark.label}</span>
            </li>
          );
        })}
      </ul>

      {line.length > 0 ? (
        <BestLine line={line} step={step} onStep={onStep} />
      ) : (
        <p className="text-sm text-ink-muted">
          Best move <span className="font-mono font-medium text-ink">{result.bestMove}</span>
        </p>
      )}

      {result.source && <SourceBox source={result.source} sideToMove={result.position.side_to_move} />}
    </div>
  );
}

/** "Best line 7. Nf3 d5 8. c4": click a move, or use the arrows, to see it on the board. */
function BestLine({ line, step, onStep }: { line: LineStep[]; step: number; onStep: (i: number) => void }) {
  const stepBtn =
    "grid size-7 place-items-center rounded-md border border-line hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-muted">Best line</span>
        <span className="flex gap-1">
          <button type="button" aria-label="Previous move" className={stepBtn} disabled={step === 0} onClick={() => onStep(step - 1)}>
            <CaretLeft size={14} weight="bold" />
          </button>
          <button
            type="button"
            aria-label="Next move"
            className={stepBtn}
            disabled={step >= line.length - 1}
            onClick={() => onStep(step + 1)}
          >
            <CaretRight size={14} weight="bold" />
          </button>
        </span>
      </div>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 font-mono">
        {line.map((m, i) => (
          <li key={i} className="flex items-center">
            {m.number && <span className="mr-0.5 text-sm text-ink-muted">{m.number}</span>}
            <button
              type="button"
              onClick={() => onStep(i)}
              aria-current={i === step ? "step" : undefined}
              className={`rounded-md px-1.5 py-0.5 font-semibold transition ${
                i === step ? "bg-accent text-accent-ink" : "hover:bg-surface"
              }`}
            >
              {m.san}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
