import { ArrowLeft, Fire, HourglassMedium, Lightning, type Icon } from "@phosphor-icons/react";
import { MATCH, TIME_CONTROLS, type TimeControl } from "@eval-guess/shared";
import { Screen, TopBar } from "./Layout";

const OPTIONS: { id: TimeControl; label: string; icon: Icon }[] = [
  { id: "bullet", label: "Bullet", icon: Lightning },
  { id: "blitz", label: "Blitz", icon: Fire },
  { id: "rapid", label: "Rapid", icon: HourglassMedium },
];

export function TimeControlSelect({
  onBack,
  onPick,
}: {
  onBack: () => void;
  onPick: (tc: TimeControl) => void;
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
        <div className="grid gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Pick a time control</h1>
          <p className="text-ink-muted">{MATCH.positionsPerMatch} positions. The clock is per position.</p>
        </div>
        <div className="grid gap-3">
          {OPTIONS.map(({ id, label, icon: IconCmp }) => (
            <button
              key={id}
              type="button"
              onClick={() => onPick(id)}
              className="flex min-h-16 items-center gap-4 rounded-xl border border-line bg-surface-raised px-5 text-left transition hover:border-accent active:scale-[0.98]"
            >
              <IconCmp size={26} weight="duotone" className="text-accent" aria-hidden />
              <span className="flex-1 text-lg font-semibold">{label}</span>
              <span className="font-mono text-lg tabular-nums text-ink-muted">{TIME_CONTROLS[id]}s</span>
            </button>
          ))}
        </div>
      </div>
    </Screen>
  );
}
