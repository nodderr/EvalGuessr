import { Timer } from "@phosphor-icons/react";

/** Time left in the round. Turns to the warning colour in the last 5 seconds. */
export function Countdown({ seconds, total }: { seconds: number; total: number }) {
  const urgent = seconds <= 5;
  const shown = Math.ceil(seconds);
  return (
    <div
      className={`flex items-center gap-1.5 font-mono text-lg font-semibold tabular-nums ${urgent ? "text-bad" : ""}`}
      role="timer"
      aria-label={`${shown} seconds left`}
    >
      <Timer size={20} weight="bold" aria-hidden />
      {shown}s
      <span className="sr-only">of {total}</span>
    </div>
  );
}
