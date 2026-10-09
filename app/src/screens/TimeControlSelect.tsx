import { ArrowLeft, Fire, HourglassMedium, Infinity as InfinityIcon, Lightning, type Icon } from "@phosphor-icons/react";
import { MATCH, TIME_CONTROLS, type TimeControl } from "@eval-guess/shared";
import { Screen, TopBar } from "./Layout";

/** null = endless: no clock, no position limit. */
const OPTIONS: { id: TimeControl | null; label: string; detail: string; icon: Icon }[] = [
  { id: "bullet", label: "Bullet", detail: `${TIME_CONTROLS.bullet}s`, icon: Lightning },
  { id: "blitz", label: "Blitz", detail: `${TIME_CONTROLS.blitz}s`, icon: Fire },
  { id: "rapid", label: "Rapid", detail: `${TIME_CONTROLS.rapid}s`, icon: HourglassMedium },
  { id: null, label: "Endless", detail: "No clock", icon: InfinityIcon },
];

export function TimeControlSelect({
  onBack,
  onPick,
  busy = false,
  error = null,
}: {
  onBack: () => void;
  onPick: (tc: TimeControl | null) => void;
  busy?: boolean;
  error?: string | null;
}) {
  return (
    <Screen>
      <TopBar
        left={
          <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 font-medium">
            <ArrowLeft size={20} weight="bold" aria-hidden />
            Back
          </button>
        }
      />
      <div className="mx-auto grid max-w-md gap-6 pt-2 md:pt-10">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Practice</h1>
          <p className="text-ink-muted">{MATCH.positionsPerMatch} positions, or endless.</p>
        </div>
        <div className="grid gap-3">
          {OPTIONS.map(({ id, label, detail, icon: IconCmp }) => (
            <button
              key={label}
              type="button"
              onClick={() => onPick(id)}
              disabled={busy}
              className="flex min-h-16 items-center gap-4 rounded-xl border border-line bg-surface-raised px-5 text-left transition hover:border-accent active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <IconCmp size={26} weight="duotone" className="text-accent" aria-hidden />
              <span className="flex-1 text-lg font-semibold">{label}</span>
              <span className="font-mono text-lg tabular-nums text-ink-muted">{detail}</span>
            </button>
          ))}
        </div>
        {busy && <p className="text-ink-muted">Starting…</p>}
        {error && (
          <p role="alert" className="text-sm text-bad">
            {error}
          </p>
        )}
      </div>
    </Screen>
  );
}
