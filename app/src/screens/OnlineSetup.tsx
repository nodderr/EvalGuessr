import { useState, type FormEvent } from "react";
import { ArrowLeft, Fire, HourglassMedium, Lightning, type Icon } from "@phosphor-icons/react";
import { MATCH, TIME_CONTROLS, type TimeControl } from "@eval-guess/shared";
import { Button } from "../components/Button";
import { Screen, TopBar } from "./Layout";

const TIME_OPTIONS: { id: TimeControl; label: string; icon: Icon }[] = [
  { id: "bullet", label: "Bullet", icon: Lightning },
  { id: "blitz", label: "Blitz", icon: Fire },
  { id: "rapid", label: "Rapid", icon: HourglassMedium },
];

const CODE_LENGTH = 5;
const inputClass =
  "min-h-12 w-full rounded-xl border border-line bg-surface-raised px-4 text-lg text-ink outline-none placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent/30";

function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <TopBar
      left={
        <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 font-medium">
          <ArrowLeft size={20} weight="bold" aria-hidden />
          Back
        </button>
      }
    />
  );
}

function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-2">
      <label htmlFor="player-name" className="font-medium">
        Your name
      </label>
      <input
        id="player-name"
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={20}
        autoComplete="nickname"
        placeholder="Shown to your opponent"
      />
    </div>
  );
}

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-bad">
      {error}
    </p>
  ) : null;
}

/** Play a friend: name + time control, then create the match. */
export function CreateMatch({
  initialName,
  busy,
  error,
  onBack,
  onCreate,
}: {
  initialName: string;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onCreate: (name: string, tc: TimeControl) => void;
}) {
  const [name, setName] = useState(initialName);
  const ready = name.trim().length > 0 && !busy;

  return (
    <Screen>
      <BackBar onBack={onBack} />
      <div className="mx-auto grid max-w-md gap-6 pt-2 md:pt-8">
        <div className="grid gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Play a friend</h1>
          <p className="text-ink-muted">
            {MATCH.positionsPerMatch} positions, same for both of you. You'll get a code to send them.
          </p>
        </div>
        <NameField value={name} onChange={setName} />
        <div className="grid gap-3">
          <span className="font-medium">Time per position</span>
          {TIME_OPTIONS.map(({ id, label, icon: IconCmp }) => (
            <button
              key={id}
              type="button"
              disabled={!ready}
              onClick={() => onCreate(name.trim(), id)}
              className="flex min-h-16 items-center gap-4 rounded-xl border border-line bg-surface-raised px-5 text-left transition hover:border-accent active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <IconCmp size={26} weight="duotone" className="text-accent" aria-hidden />
              <span className="flex-1 text-lg font-semibold">{label}</span>
              <span className="font-mono text-lg tabular-nums text-ink-muted">{TIME_CONTROLS[id]}s</span>
            </button>
          ))}
          {!name.trim() && <p className="text-sm text-ink-muted">Enter your name first.</p>}
        </div>
        {busy && <p className="text-ink-muted">Creating your match…</p>}
        <ErrorText error={error} />
      </div>
    </Screen>
  );
}

/** Join a friend: name + code. The code may come pre-filled from a share link. */
export function JoinMatch({
  initialName,
  initialCode,
  busy,
  error,
  onBack,
  onJoin,
}: {
  initialName: string;
  initialCode: string;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onJoin: (name: string, code: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode.toUpperCase());
  const ready = name.trim().length > 0 && code.length === CODE_LENGTH && !busy;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ready) onJoin(name.trim(), code);
  };

  return (
    <Screen>
      <BackBar onBack={onBack} />
      <form onSubmit={submit} className="mx-auto grid max-w-md gap-6 pt-2 md:pt-8">
        <div className="grid gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Join a friend</h1>
          <p className="text-ink-muted">Enter the code they sent you.</p>
        </div>
        <NameField value={name} onChange={setName} />
        <div className="grid gap-2">
          <label htmlFor="match-code" className="font-medium">
            Match code
          </label>
          <input
            id="match-code"
            className={`${inputClass} font-mono text-2xl tracking-[0.3em] uppercase`}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH))}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="K7QPX"
          />
        </div>
        <Button type="submit" disabled={!ready}>
          {busy ? "Joining…" : "Join match"}
        </Button>
        <ErrorText error={error} />
      </form>
    </Screen>
  );
}
