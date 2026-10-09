import { useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { SCORING, TIME_CONTROLS, formatEval, normalizeGuess, scoreGuess } from "@eval-guess/shared";
import { Button } from "../components/Button";
import { EvalBoard } from "../components/EvalBoard";
import { useGuessKeys } from "../components/useGuessKeys";
import { GuessReadout } from "../components/GuessReadout";
import { TONE_CLASS, resultMark } from "../components/resultMark";
import { BOARD_COLUMN, SIDE_COLUMN, Screen, TopBar } from "./Layout";

/**
 * The tutorial's sample position is fixed and its eval is public on purpose:
 * it is not part of the match pool. Stockfish 19, 5s: +0.19.
 */
const SAMPLE = {
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  evalPawns: 0.19,
};

export function Tutorial({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  const [guess, setGuess] = useState(0);
  const [locked, setLocked] = useState(false);
  const result = scoreGuess(normalizeGuess(guess), SAMPLE.evalPawns);
  const mark = resultMark({ ...result, guess });
  useGuessKeys({ enabled: !locked, value: guess, orientation: "white", onChange: setGuess, onSubmit: () => setLocked(true) });

  return (
    <Screen split>
      <div className={BOARD_COLUMN}>
        <EvalBoard
          fen={SAMPLE.fen}
          orientation="white"
          guess={guess}
          onGuess={setGuess}
          disabled={locked}
          reveal={locked ? { evalPawns: SAMPLE.evalPawns, markers: [{ key: "you", value: normalizeGuess(guess), self: true }] } : undefined}
        />
      </div>

      <div className={SIDE_COLUMN}>
        <TopBar
          className="order-first lg:order-none"
          left={
            <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 font-medium">
              <ArrowLeft size={20} weight="bold" aria-hidden />
              Back
            </button>
          }
        />
        <div className="grid gap-6">
          <section className="grid gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">How to play</h1>
            <ul className="grid gap-3 leading-relaxed">
              <li>Guess Stockfish's eval by dragging the bar. Plus is good for White, minus for Black.</li>
              <li>
                Bullet {TIME_CONTROLS.bullet}s, blitz {TIME_CONTROLS.blitz}s, rapid {TIME_CONTROLS.rapid}s per position.
                When time runs out, your current guess counts. Endless has no clock.
              </li>
              <li>
                Within {SCORING.perfectWindow.toFixed(1)} pawn: 100 points. {SCORING.zeroAt.toFixed(1)} or more off: 0.
              </li>
            </ul>
          </section>

          <section className="grid gap-4 rounded-xl bg-surface-raised p-4">
            <h2 className="font-semibold">Try it</h2>
            <GuessReadout value={guess} locked={locked} />
            {locked ? (
              <p aria-live="polite">
                Stockfish <span className="font-mono font-semibold">{formatEval(SAMPLE.evalPawns)}</span>.{" "}
                <span className={`font-semibold ${TONE_CLASS[mark.tone]}`}>{mark.label}</span>, {result.points} points.
              </p>
            ) : (
              <Button onClick={() => setLocked(true)}>Lock in</Button>
            )}
            {locked && (
              <Button variant="secondary" onClick={() => setLocked(false)}>
                Try again
              </Button>
            )}
          </section>

          <Button onClick={onStart}>Start practice</Button>
        </div>
      </div>
    </Screen>
  );
}
