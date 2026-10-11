import { SCORING, type MatchView } from "@eval-guess/shared";
import { Button } from "../components/Button";
import { RoundCard } from "../components/RoundCard";
import { Screen } from "./Layout";

type Props = {
  view: MatchView;
  /** Practice: start a new match. Online: ask for a rematch. */
  onPlayAgain: () => void;
  onHome: () => void;
};

/**
 * End of a match: the result and actions at the top (so Rematch never needs a
 * scroll), then every position as a board with its eval, the guesses and a
 * Lichess link.
 */
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
      <div className="grid gap-8 pt-2 md:pt-8">
        <header className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
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

          <div className="grid gap-3 md:w-80">
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={onPlayAgain} disabled={multiplayer && (me.wantsRematch || opponentGone)}>
                {!multiplayer ? "Play again" : me.wantsRematch ? "Requested" : "Rematch"}
              </Button>
              <Button variant="secondary" onClick={onHome}>
                Home
              </Button>
            </div>
            {multiplayer && (
              <p className="min-h-5 text-center text-sm text-ink-muted" aria-live="polite">
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
        </header>

        {played === 0 ? (
          <p className="text-ink-muted">No positions played.</p>
        ) : (
          <ol aria-label="Positions" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {view.results.map((round, i) => (
              // Endless can repeat a position, so the index is the key.
              <RoundCard key={i} round={round} index={i} players={view.players} you={view.you} />
            ))}
          </ol>
        )}
      </div>
    </Screen>
  );
}
