import { useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { SCORING, TIME_CONTROLS, formatEval, normalizeGuess, scoreGuess } from "@eval-guess/shared";
import { ToMove } from "../components/Board";
import { Button } from "../components/Button";
import { EvalBoard } from "../components/EvalBoard";
import { GuessReadout } from "../components/GuessReadout";
import { TONE_CLASS, resultMark } from "../components/resultMark";
import { BOARD_COLUMN, Screen, TopBar } from "./Layout";

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

  return (
    <Screen split>
      <TopBar
        left={
          <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 font-medium">
            <ArrowLeft size={20} weight="bold" aria-hidden />
            Back
          </button>
        }
      />

      <div className={BOARD_COLUMN}>
        <ToMove side="white" />
        <EvalBoard
          fen={SAMPLE.fen}
          orientation="white"
          guess={guess}
          onGuess={setGuess}
          disabled={locked}
          reveal={locked ? { evalPawns: SAMPLE.evalPawns, markers: [{ key: "you", value: normalizeGuess(guess), self: true }] } : undefined}
        />
      </div>

      <div className="grid gap-6">
        <section className="grid gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">How to play</h1>
          <p className="leading-relaxed text-ink-muted">
            Each match is five positions. Guess how Stockfish rates each one, in pawns.
          </p>
        </section>

        <ul className="grid gap-4 leading-relaxed">
          <li>
            <strong className="font-semibold">Drag the eval bar beside the board.</strong>{" "}
            <span className="text-ink-muted">
              More white means White is better, more black means Black is. Plus is always good for White, even
              when the board is turned around for Black to move.
            </span>
          </li>
          <li>
            <strong className="font-semibold">Beat the clock.</strong>{" "}
            <span className="text-ink-muted">
              Bullet gives you {TIME_CONTROLS.bullet}s per position, blitz {TIME_CONTROLS.blitz}s, rapid{" "}
              {TIME_CONTROLS.rapid}s. If time runs out, wherever your slider sits is your guess.
            </span>
          </li>
          <li>
            <strong className="font-semibold">Within {SCORING.perfectWindow.toFixed(1)} pawns scores 100.</strong>{" "}
            <span className="text-ink-muted">
              Further off, points drop steadily to 0 at {SCORING.zeroAt.toFixed(1)} pawns away.
            </span>
          </li>
        </ul>

        <section className="grid gap-4 rounded-xl bg-surface-raised p-4">
          <h2 className="font-semibold">Try it on the starting position</h2>
          <GuessReadout value={guess} locked={locked} />
          {locked ? (
            <div className="grid gap-1" aria-live="polite">
              <p>
                Stockfish says <span className="font-mono font-semibold">{formatEval(SAMPLE.evalPawns)}</span>. You
                were off by {result.gap.toFixed(1)}.
              </p>
              <p>
                <span className={`font-semibold ${TONE_CLASS[mark.tone]}`}>{mark.label}</span>
                <span className="text-ink-muted">, {result.points} points. White starts with a small edge.</span>
              </p>
            </div>
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
    </Screen>
  );
}
