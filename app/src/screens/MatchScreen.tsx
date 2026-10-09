import { useEffect, useMemo, useRef, useState } from "react";
import { MATCH, type MatchView } from "@eval-guess/shared";
import { Button } from "../components/Button";
import { EvalBoard } from "../components/EvalBoard";
import { GuessReadout } from "../components/GuessReadout";
import { LINE_ARROW_COLOR, lineSteps } from "../components/line";
import { MatchHistory, PanelHeader, PlayerRows } from "../components/panel";
import { useGuessKeys } from "../components/useGuessKeys";
import { RoundReveal } from "../components/RoundReveal";
import type { MatchClient } from "../game/MatchClient";
import { useCountdown } from "../game/useMatch";
import { BOARD_COLUMN, PANEL, Screen } from "./Layout";

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

  // After the reveal: Stockfish's line, stepped through on the board with an arrow per move.
  const line = useMemo(() => (result ? lineSteps(position.fen, result.line) : []), [result, position.fen]);
  const [step, setStep] = useState(0);
  const shown = revealed ? line[step] : undefined;
  useEffect(() => {
    if (!revealed || line.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("input, textarea")) return;
      if (e.key === "ArrowRight") setStep((s) => Math.min(line.length - 1, s + 1));
      else if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, line.length]);
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
        <EvalBoard
          fen={shown ? shown.fenBefore : position.fen}
          arrows={shown ? [{ startSquare: shown.from, endSquare: shown.to, color: LINE_ARROW_COLOR }] : undefined}
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

      <aside className={PANEL.root} aria-label="Match">
        <PanelHeader view={view} secondsLeft={revealed ? null : secondsLeft} onQuit={onQuit} />
        <PlayerRows view={view} />

        <div className={PANEL.body}>
          {revealed && result ? (
            <RoundReveal result={result} players={view.players} you={view.you} line={line} step={step} onStep={setStep} />
          ) : (
            <GuessReadout value={view.yourGuess ?? guess} locked={locked} />
          )}
          {error && (
            <p role="alert" className="text-sm text-bad">
              {error}
            </p>
          )}
          {/* Earlier positions; the one just revealed is shown above, not repeated here. */}
          <MatchHistory view={view} upTo={revealed ? view.results.length - 1 : view.results.length} />
        </div>

        <div className={PANEL.footer}>
          {revealed ? (
            <>
              <Button onClick={() => void client.ready().catch(() => {})} disabled={me.readyForNext}>
                {isLastRound ? "See results" : "Next position"}
                {advanceIn !== null && <span className="font-mono text-sm font-normal opacity-80">{Math.ceil(advanceIn)}s</span>}
              </Button>
              {me.readyForNext && waitingOn.length > 0 && (
                <p className="text-center text-sm text-ink-muted" aria-live="polite">
                  Waiting for {waitingOn.map((p) => p.name).join(", ")}
                </p>
              )}
            </>
          ) : (
            <>
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
          {endless && (
            <Button variant="secondary" onClick={() => void client.finish().catch(() => {})}>
              End session
            </Button>
          )}
        </div>
      </aside>
    </Screen>
  );
}
