import { formatEval, SCORING, type MatchView } from "@eval-guess/shared";
import { Button } from "../components/Button";
import { TONE_CLASS, resultMark } from "../components/resultMark";
import { Screen } from "./Layout";

type Props = {
  view: MatchView;
  /** Practice: start a new match. Online: ask for a rematch. */
  onPlayAgain: () => void;
  onHome: () => void;
};

export function Summary({ view, onPlayAgain, onHome }: Props) {
  const endless = view.mode === "endless";
  const played = view.results.length;
  // Endless sessions are scored out of the positions actually played.
  const maxTotal = (view.totalRounds ?? played) * SCORING.maxPoints;
  const ranked = [...view.players].sort((a, b) => b.score - a.score);
  const me = view.players.find((p) => p.id === view.you)!;
  const multiplayer = view.players.length > 1;
  const top = ranked[0]!;
  const tie = multiplayer && ranked.filter((p) => p.score === top.score).length > 1;
  const headline = endless
    ? `${played} position${played === 1 ? "" : "s"}`
    : !multiplayer
      ? "Match complete"
      : tie
        ? "Draw"
        : top.id === view.you
          ? "You win"
          : `${top.name} wins`;
  const others = view.players.filter((p) => p.id !== view.you);
  const opponentGone = others.some((p) => !p.connected);
  const askedBy = others.filter((p) => p.wantsRematch);

  return (
    <Screen>
      <div className="mx-auto grid max-w-xl gap-8 pt-2 md:pt-10">
        <div className="grid gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{headline}</h1>
          <p className="font-mono text-5xl font-semibold tabular-nums">
            {me.score}
            <span className="text-2xl text-ink-muted"> / {maxTotal}</span>
          </p>
          {multiplayer && (
            <p className="text-ink-muted">
              {ranked
                .filter((p) => p.id !== view.you)
                .map((p) => `${p.name}: ${p.score}`)
                .join(", ")}
            </p>
          )}
          {endless && played > 0 && (
            <p className="text-ink-muted">Average {Math.round(me.score / played)} per position</p>
          )}
        </div>

        <ol className="grid gap-2">
          {view.results.map((round, i) => {
            const mine = round.byPlayer[view.you]!;
            const mark = resultMark(mine);
            return (
              <li key={round.position.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 rounded-xl bg-surface-raised px-4 py-3">
                <span className="font-mono text-ink-muted">{i + 1}</span>
                <div className="grid">
                  <span>
                    Stockfish <span className="font-mono font-semibold">{formatEval(round.evalPawns)}</span>
                    <span className="text-ink-muted">
                      {", you "}
                      {mine.guess === null ? "ran out of time" : <span className="font-mono">{formatEval(mine.guess)}</span>}
                      {others.map((p) => {
                        const theirs = round.byPlayer[p.id];
                        if (!theirs) return null;
                        return (
                          <span key={p.id}>
                            {`, ${p.name} `}
                            {theirs.guess === null ? "timed out" : <span className="font-mono">{formatEval(theirs.guess)}</span>}
                          </span>
                        );
                      })}
                    </span>
                  </span>
                  <span className={`text-sm font-semibold ${TONE_CLASS[mark.tone]}`}>
                    {mark.label}
                    {mine.gap !== null && <span className="font-normal text-ink-muted">, off by {mine.gap.toFixed(1)}</span>}
                  </span>
                </div>
                <span className="font-mono text-lg font-semibold tabular-nums">{mine.points}</span>
              </li>
            );
          })}
        </ol>

        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button onClick={onPlayAgain} disabled={multiplayer && (me.wantsRematch || opponentGone)}>
              {!multiplayer ? "Play again" : me.wantsRematch ? "Requested" : "Rematch"}
            </Button>
            <Button variant="secondary" onClick={onHome}>
              Home
            </Button>
          </div>
          {multiplayer && (
            <p className="text-center text-sm text-ink-muted" aria-live="polite">
              {opponentGone
                ? "Opponent disconnected."
                : me.wantsRematch
                  ? `Waiting for ${others.filter((p) => !p.wantsRematch).map((p) => p.name).join(", ")}.`
                  : askedBy.length > 0
                    ? `${askedBy.map((p) => p.name).join(", ")} wants a rematch.`
                    : null}
            </p>
          )}
        </div>
      </div>
    </Screen>
  );
}
