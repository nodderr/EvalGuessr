import { formatEval, type MatchView, type RoundResult } from "@eval-guess/shared";
import { TONE_CLASS, resultMark } from "./resultMark";

type Props = {
  result: RoundResult;
  players: MatchView["players"];
  you: string;
};

/**
 * Stockfish's eval plus one row per player. Written for any number of players:
 * practice shows one row, 1v1 shows two.
 */
export function RoundReveal({ result, players, you }: Props) {
  // Put the viewer first.
  const ordered = [...players].sort((a, b) => Number(b.id === you) - Number(a.id === you));

  return (
    <div className="grid gap-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-ink-muted">Stockfish</span>
        <span className="font-mono text-4xl font-semibold tabular-nums">{formatEval(result.evalPawns)}</span>
      </div>

      <ul className="grid gap-2">
        {ordered.map((p) => {
          const r = result.byPlayer[p.id];
          if (!r) return null;
          const mark = resultMark(r);
          return (
            <li key={p.id} className="grid grid-cols-[1fr_auto] gap-x-3 rounded-xl bg-surface-raised px-4 py-3">
              <span className="flex items-center gap-2 font-medium">
                {/* Matches this player's marker on the eval bar. */}
                <span aria-hidden className={`h-1 w-4 rounded-full ${p.id === you ? "bg-you" : "bg-opponent"}`} />
                {p.id === you ? "You" : p.name}
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums">{r.points > 0 ? `+${r.points}` : "0"}</span>
              <span className="text-sm text-ink-muted">
                {r.guess === null
                  ? "No guess"
                  : `${formatEval(r.guess)}, off by ${r.gap!.toFixed(1)}`}
              </span>
              <span className={`text-sm font-semibold ${TONE_CLASS[mark.tone]}`}>{mark.label}</span>
            </li>
          );
        })}
      </ul>

      <p className="text-sm text-ink-muted">
        Best move: <span className="font-mono font-medium text-ink">{result.bestMove}</span>
      </p>
    </div>
  );
}
