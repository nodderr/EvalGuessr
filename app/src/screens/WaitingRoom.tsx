import { useState } from "react";
import { Check, Copy, ShareNetwork } from "@phosphor-icons/react";
import { TIME_CONTROLS, type MatchView } from "@eval-guess/shared";
import { Button } from "../components/Button";
import { Screen } from "./Layout";

/** Shown to the creator of an online match until the opponent joins. */
export function WaitingRoom({ view, onCancel }: { view: MatchView; onCancel: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/?join=${view.id}`;
  const canShare = typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the link is still visible to copy by hand */
    }
  };

  const share = () => {
    navigator.share({ title: "Guess the eval", text: `Join my match: ${view.id}`, url: link }).catch(() => {});
  };

  return (
    <Screen>
      <div className="mx-auto grid max-w-md gap-8 pt-6 md:pt-14">
        <div className="grid gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Waiting for your opponent</h1>
          <p className="text-ink-muted">
            Send them this code or link. The match starts as soon as they join. {view.timeControl[0]!.toUpperCase()}
            {view.timeControl.slice(1)}, {TIME_CONTROLS[view.timeControl]}s per position.
          </p>
        </div>

        <div className="grid gap-3 rounded-xl bg-surface-raised p-5 text-center">
          <span className="text-sm text-ink-muted">Match code</span>
          <span className="font-mono text-5xl font-semibold tracking-[0.25em] select-all">{view.id}</span>
          <span className="truncate font-mono text-sm text-ink-muted select-all">{link}</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button onClick={() => void copy()}>
            {copied ? <Check size={20} weight="bold" aria-hidden /> : <Copy size={20} weight="bold" aria-hidden />}
            {copied ? "Copied" : "Copy link"}
          </Button>
          {canShare ? (
            <Button variant="secondary" onClick={share}>
              <ShareNetwork size={20} weight="bold" aria-hidden />
              Share
            </Button>
          ) : (
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
        {canShare && (
          <button type="button" onClick={onCancel} className="justify-self-center text-ink-muted underline-offset-4 hover:underline">
            Cancel match
          </button>
        )}
      </div>
    </Screen>
  );
}
