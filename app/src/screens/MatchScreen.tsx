import { useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";
import { MATCH, type MatchView } from "@eval-guess/shared";
import { ToMove } from "../components/Board";
import { Button } from "../components/Button";
import { Countdown } from "../components/Countdown";
import { EvalBoard } from "../components/EvalBoard";
import { GuessReadout } from "../components/GuessReadout";
import { useGuessKeys } from "../components/useGuessKeys";
import { RoundReveal } from "../components/RoundReveal";
import type { MatchClient } from "../game/MatchClient";
import { useCountdown } from "../game/useMatch";
import { BOARD_COLUMN, SIDE_COLUMN, Screen, TopBar } from "./Layout";

type Props = {
  view: MatchView;
  client: MatchClient;
  onQuit: () => void;
};

/** Guessing and reveal for one round. Keyed by round in App so each round starts fresh. */
export function MatchScreen({ view, client, onQuit }: Props) {
  const position = view.position!;
  const me = view.players.find((p) => p.id === view.you)!;
  const revealed = view.phase === "revealed";
  const result = revealed ? view.results[view.results.length - 1] : undefined;
  const endless = view.mode === "endless";
  const isLastRound = view.totalRounds !== null && view.roundIndex + 1 >= view.totalRounds;
  const waitingOn = view.players.filter((p) => p.id !== view.you && !p.readyForNext && p.connected);
  const opponents = view.players.filter((p) => p.id !== view.you);
  const online = view.mode === "online";

  // Online matches move on by themselves after a reveal; show when.
  const revealedAt = useRef<number | null>(null);
  if (revealed && revealedAt.current === null) revealedAt.current = Date.now();
  const advanceIn = useCountdown(
    online && revealed && revealedAt.current !== null ? revealedAt.current + MATCH.revealAutoAdvanceMs : null,
    revealedAt.current ?? 0,
  );

  const [guess, setGuess] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const secondsLeft = useCountdown(view.roundDeadline, view.serverNow);
  const locked = me.hasGuessed || view.yourGuess !== null;

  const lockIn = async (value: number) => {
    setError(null);
    try {
      await client.submitGuess(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't submit.");
    }
  };

  // When the clock hits zero, submit wherever the slider is. guessRef avoids
  // re-running the effect on every slider move.
  const guessRef = useRef(guess);
  guessRef.current = guess;
  const autoSubmitted = useRef(false);

  // Arrow keys work without clicking the bar first; Enter locks in.
  useGuessKeys({
    enabled: view.phase === "guessing" && !locked,
    value: guess,
    orientation: position.side_to_move,
    onChange: setGuess,
    onSubmit: () => void lockIn(guessRef.current),
  });
  useEffect(() => {
    if (secondsLeft === 0 && !locked && !autoSubmitted.current && view.phase === "guessing") {
      autoSubmitted.current = true;
      void lockIn(guessRef.current);
    }
  });

  return (
    <Screen split>
      <div className={BOARD_COLUMN}>
        <ToMove side={position.side_to_move} className="lg:hidden" />
        <EvalBoard
          fen={position.fen}
          orientation={position.side_to_move}
          guess={view.yourGuess ?? guess}
          onGuess={setGuess}
          disabled={locked}
          wheelAnywhere
          reveal={
            result && {
              evalPawns: result.evalPawns,
              markers: Object.entries(result.byPlayer)
                .filter(([, r]) => r.guess !== null)
                .map(([id, r]) => ({ key: id, value: r.guess!, self: id === view.you })),
            }
          }
        />
      </div>

      <div className={SIDE_COLUMN}>
        <TopBar
          className="order-first lg:order-none"
          left={
            <>
              <button
                type="button"
                onClick={onQuit}
                aria-label="Quit match"
                className="-ml-2 grid size-11 place-items-center rounded-xl hover:bg-surface-raised"
              >
                <X size={22} weight="bold" />
              </button>
              <span className="font-medium">
                Position {view.roundIndex + 1}
                {view.totalRounds !== null ? ` of ${view.totalRounds}` : ""}
                {endless && <span className="font-normal text-ink-muted"> · Endless</span>}
              </span>
            </>
          }
          right={
            <>
              <span className="font-mono text-lg tabular-nums">
                <span className="sr-only">Score </span>
                {me.score}
              </span>
              {!revealed && secondsLeft !== null && (
                <Countdown seconds={secondsLeft} total={view.secondsPerPosition ?? 0} />
              )}
            </>
          }
        />
        <div className="hidden lg:block">
          <ToMove side={position.side_to_move} />
        </div>
        <div className="grid gap-5">
          {opponents.length > 0 && <PlayerStatus view={view} />}
          {revealed && result ? (
            <>
              <RoundReveal result={result} players={view.players} you={view.you} />
              <Button onClick={() => void client.ready().catch(() => {})} disabled={me.readyForNext}>
                {isLastRound ? "See results" : "Next position"}
              </Button>
              {(me.readyForNext && waitingOn.length > 0) || advanceIn !== null ? (
                <p className="text-center text-sm text-ink-muted" aria-live="polite">
                  {me.readyForNext && waitingOn.length > 0 ? `Waiting for ${waitingOn.map((p) => p.name).join(", ")}. ` : ""}
                  {advanceIn !== null && `Next in ${Math.ceil(advanceIn)}s`}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <GuessReadout value={view.yourGuess ?? guess} locked={locked} />
              <Button onClick={() => void lockIn(guess)} disabled={locked}>
                {locked ? "Locked in" : "Lock in"}
              </Button>
              {locked && opponents.some((p) => !p.hasGuessed) && (
                <p className="text-center text-sm text-ink-muted" aria-live="polite">
                  Waiting for {opponents.filter((p) => !p.hasGuessed).map((p) => p.name).join(", ")}
                </p>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-bad">
              {error}
            </p>
          )}
          {endless && (
            <Button variant="secondary" onClick={() => void client.finish().catch(() => {})}>
              End session
            </Button>
          )}
        </div>
      </div>
    </Screen>
  );
}

/** One line per player (you first): name, score, and what they're doing right now. */
function PlayerStatus({ view }: { view: MatchView }) {
  const ordered = [...view.players].sort((a, b) => Number(b.id === view.you) - Number(a.id === view.you));
  return (
    <ul className="grid gap-1.5">
      {ordered.map((p) => {
        const isYou = p.id === view.you;
        const [label, tone] = !p.connected
          ? ["Reconnecting…", "text-bad"]
          : view.phase === "guessing"
            ? p.hasGuessed
              ? ["Locked in", "text-good"]
              : ["Guessing", "text-ink-muted"]
            : p.readyForNext
              ? ["Ready", "text-good"]
              : ["Reviewing", "text-ink-muted"];
        return (
          <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5">
            <span className="flex min-w-0 items-center gap-2 font-medium">
              <span aria-hidden className={`h-1 w-4 shrink-0 rounded-full ${isYou ? "bg-you" : "bg-opponent"}`} />
              <span className="truncate">
                {p.name}
                {isYou && <span className="font-normal text-ink-muted"> (you)</span>}
              </span>
              <span className="font-mono text-ink-muted tabular-nums">{p.score}</span>
            </span>
            <span className={`shrink-0 text-sm font-semibold ${tone}`} aria-live="polite">
              {label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
