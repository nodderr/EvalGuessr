import { WifiSlash, SpinnerGap } from "@phosphor-icons/react";
import type { ConnectionStatus } from "../game/MatchClient";

const COPY: Record<Exclude<ConnectionStatus, "connected">, string> = {
  connecting: "Connecting…",
  waking: "Starting the server. This can take a minute.",
  reconnecting: "Reconnecting…",
};

/** Thin status strip shown at the top of the page whenever we are not connected. */
export function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  if (status === "connected") return null;
  const Icon = status === "reconnecting" ? WifiSlash : SpinnerGap;
  return (
    <div
      role="status"
      className="sticky top-0 z-10 flex items-center justify-center gap-2 border-b border-line bg-surface-raised px-4 py-2 text-center text-sm"
    >
      <Icon size={18} weight="bold" className={status === "reconnecting" ? "text-bad" : "animate-spin"} aria-hidden />
      {COPY[status]}
    </div>
  );
}
