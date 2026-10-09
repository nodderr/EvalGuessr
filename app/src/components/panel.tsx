/**
 * Pieces of the match side panel (chess.com / Lichess style): header with
 * clock and progress, player rows, and the match history.
 */
import { Timer, X } from "@phosphor-icons/react";
import { formatEval, type MatchView } from "@eval-guess/shared";
import { TONE_CLASS, resultMark } from "./resultMark";

const TONE_BG = { good: "bg-good", warn: "bg-warn", bad: "bg-bad" } as const;

function modeLabel(view: MatchView): string {
  const tc = view.timeControl ? `${view.timeControl[0]!.toUpperCase()}${view.timeControl.slice(1)}` : "";
  if (view.mode === "endless") return "Endless practice";
  if (view.mode === "practice") return `Practice · ${tc}`;
  return `1v1 · ${tc}`;
}

/** chess.com-style clock box: m:ss, red in the last 5 seconds. */
export function Clock({ seconds }: { seconds: number }) {
  const s = Math.ceil(seconds);
  const urgent = s <= 5;
  return (
    <div
      role="timer"
      aria-label={`${s} seconds left`}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xl font-semibold tabular-nums ${
        urgent ? "bg-bad text-white" : "bg-surface text-ink lg:bg-surface"
      }`}
    >
      <Timer size={18} weight="bold" aria-hidden />
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
    </div>
  );
}

/** Top of the panel: quit, mode, position counter, clock, and the progress strip. */
export function PanelHeader({
  view,
  secondsLeft,
  onQuit,
}: {
  view: MatchView;
  secondsLeft: number | null;
  onQuit: () => void;
}) {
  const me = view.players.find((p) => p.id === view.you)!;
  const played = view.results.length;
  return (
    <header className="order-first grid gap-2.5 lg:order-none lg:border-b lg:border-line lg:px-4 lg:py-3">
      <div className="flex min-h-11 items-center gap-2">
        <button
          type="button"
          onClick={onQuit}
          aria-label="Quit match"
          className="-ml-2 grid size-10 shrink-0 place-items-center rounded-lg hover:bg-surface lg:-ml-1"
        >
          <X size={20} weight="bold" />
        </button>
        <div className="grid min-w-0 leading-tight">
          <span className="font-semibold">
            Position {view.roundIndex + 1}
            {view.totalRounds !== null && <span className="font-normal text-ink-muted"> of {view.totalRounds}</span>}
          </span>
          <span className="truncate text-xs text-ink-muted">
            {modeLabel(view)}
            {view.mode === "online" && <span className="font-mono"> · {view.id}</span>}
          </span>
        </div>
        <div className="ml-auto">{secondsLeft !== null && <Clock seconds={secondsLeft} />}</div>
      </div>

      {view.totalRounds !== null ? (
        <ol className="flex gap-1" aria-label="Progress">
          {Array.from({ length: view.totalRounds }, (_, i) => {
            const mine = view.results[i]?.byPlayer[view.you];
            const tone = mine ? TONE_BG[resultMark(mine).tone] : i === view.roundIndex ? "bg-accent/40" : "bg-line";
            return <li key={i} className={`h-1.5 flex-1 rounded-full ${tone}`} aria-label={`Position ${i + 1}`} />;
          })}
        </ol>
      ) : (
        played > 0 && (
          <p className="text-xs text-ink-muted">
            {played} played · average {Math.round(me.score / played)}
          </p>
        )
      )}
    </header>
  );
}

/** One row per player (you first): avatar, name, live status, total score. */
export function PlayerRows({ view }: { view: MatchView }) {
  const ordered = [...view.players].sort((a, b) => Number(b.id === view.you) - Number(a.id === view.you));
  const solo = view.players.length === 1;
  return (
    <ul className="grid gap-1 lg:border-b lg:border-line lg:px-4 lg:py-3">
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
          <li key={p.id} className="flex items-center gap-3 py-1">
            <span
              aria-hidden
              className={`grid size-8 shrink-0 place-items-center rounded-md text-sm font-bold text-white ${
                isYou ? "bg-you" : "bg-opponent"
              }`}
            >
              {p.name.trim()[0]?.toUpperCase() ?? "?"}
            </span>
            <span className="grid min-w-0 leading-tight">
              <span className="truncate font-medium">
                {p.name}
                {isYou && !solo && <span className="font-normal text-ink-muted"> (you)</span>}
              </span>
              {!solo && (
                <span className={`text-xs font-medium ${tone}`} aria-live="polite">
                  {label}
                </span>
              )}
            </span>
            <span className="ml-auto font-mono text-xl font-semibold tabular-nums">{p.score}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Finished positions of this match, like a move list. */
export function MatchHistory({ view, upTo }: { view: MatchView; upTo: number }) {
  const rounds = view.results.slice(0, upTo);
  if (rounds.length === 0) return null;
  const others = view.players.filter((p) => p.id !== view.you);
  return (
    <section aria-label="Match history" className="grid gap-1.5 border-t border-line pt-3">
      <h2 className="text-xs font-medium tracking-wide text-ink-muted uppercase">This match</h2>
      <ol className="grid">
        {rounds
          .map((round, i) => ({ round, i }))
          .reverse()
          .map(({ round, i }) => {
            const mine = round.byPlayer[view.you]!;
            return (
              <li key={i} className="grid grid-cols-[1.5rem_3.5rem_1fr_auto] items-center gap-2 py-1 text-sm">
                <span className="font-mono text-ink-muted">{i + 1}</span>
                <span className="font-mono font-semibold tabular-nums">{formatEval(round.evalPawns)}</span>
                <span className="truncate text-ink-muted">
                  <span className="font-mono">{mine.guess === null ? "--" : formatEval(mine.guess)}</span>
                  {others.map((p) => {
                    const r = round.byPlayer[p.id];
                    return r ? (
                      <span key={p.id}>
                        {" · "}
                        {p.name} <span className="font-mono">{r.guess === null ? "--" : formatEval(r.guess)}</span>
                      </span>
                    ) : null;
                  })}
                </span>
                <span className={`font-mono font-semibold tabular-nums ${TONE_CLASS[resultMark(mine).tone]}`}>
                  {mine.points}
                </span>
              </li>
            );
          })}
      </ol>
    </section>
  );
}
