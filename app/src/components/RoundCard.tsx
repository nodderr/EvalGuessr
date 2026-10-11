import { useMemo } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { formatEval, type MatchView, type RoundResult } from "@eval-guess/shared";
import { ToMove } from "./Board";
import { lichessUrl } from "./lichess";
import { lineSteps } from "./line";
import { MiniBoard } from "./MiniBoard";
import { TONE_CLASS, resultMark } from "./resultMark";

type Props = {
  round: RoundResult;
  index: number;
  players: MatchView["players"];
  you: string;
};

/**
 * One finished position on the match summary: the board with Stockfish's best
 * move, the eval, every player's guess and points, and a link to it on Lichess.
 */
export function RoundCard({ round, index, players, you }: Props) {
  const { position } = round;
  const best = useMemo(() => lineSteps(position.fen, round.line.slice(0, 1))[0], [position.fen, round.line]);
  const url = lichessUrl(position, round.source);
  // The viewer first, as everywhere else.
  const ordered = [...players].sort((a, b) => Number(b.id === you) - Number(a.id === you));

  return (
    // content-visibility keeps long endless summaries cheap: off-screen cards skip layout and paint.
    <li className="grid content-start gap-3 rounded-xl bg-surface-raised p-3 [contain-intrinsic-size:auto_520px] [content-visibility:auto]">
      <div className="flex min-h-7 items-center justify-between gap-3 px-1">
        <span className="flex items-center gap-3">
          <span className="font-mono text-sm text-ink-muted tabular-nums">{index + 1}</span>
          <ToMove side={position.side_to_move} className="text-ink-muted" />
        </span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Position ${index + 1} on Lichess`}
          className="flex items-center gap-1 text-sm text-ink-muted underline-offset-4 hover:text-accent hover:underline"
        >
          lichess.org
          <ArrowSquareOut size={14} weight="bold" aria-hidden />
        </a>
      </div>

      {/* The board opens the same link; the text link above is the one for keyboards and screen readers. */}
      <a href={url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden className="block transition hover:opacity-90">
        <MiniBoard fen={position.fen} orientation={position.side_to_move} arrow={best} />
      </a>

      <div className="grid gap-2 px-1 pb-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-ink-muted">
            Stockfish
            {best && (
              <>
                , best <span className="font-mono font-medium text-ink">{best.san}</span>
              </>
            )}
          </span>
          <span className="font-mono text-2xl font-semibold tabular-nums">{formatEval(round.evalPawns)}</span>
        </div>
        <ul className="grid gap-1.5">
          {ordered.map((p) => {
            const r = round.byPlayer[p.id];
            if (!r) return null;
            const mark = resultMark(r);
            return (
              <li key={p.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 text-sm">
                {/* Same colour as this player's marker on the eval bar. */}
                <span aria-hidden className={`h-1 w-4 rounded-full ${p.id === you ? "bg-you" : "bg-opponent"}`} />
                <span className="truncate">
                  <span className="font-medium">{p.id === you ? "You" : p.name}</span>
                  {r.guess !== null && <span className="ml-2 font-mono text-ink-muted">{formatEval(r.guess)}</span>}
                  <span className={`ml-2 font-semibold ${TONE_CLASS[mark.tone]}`}>{mark.label}</span>
                </span>
                <span className="font-mono text-base font-semibold tabular-nums">{r.points}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </li>
  );
}
