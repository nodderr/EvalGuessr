import { formatEval } from "@eval-guess/shared";

/** Large readout of the current guess. The input itself is the eval bar beside the board. */
export function GuessReadout({ value, locked }: { value: number; locked: boolean }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-ink-muted">Your guess</span>
        <span className="font-mono text-3xl font-semibold tabular-nums" aria-live="polite">
          {formatEval(value)}
        </span>
      </div>
      {!locked && (
        <p className="text-sm text-ink-muted">Drag the bar, scroll, or use the arrow keys or W/S.</p>
      )}
    </div>
  );
}
