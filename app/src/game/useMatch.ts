import { useEffect, useMemo, useState } from "react";
import type { MatchView } from "@eval-guess/shared";
import type { ConnectionStatus, MatchClient } from "./MatchClient";

/** Subscribe a component to a MatchClient's latest view. */
export function useMatchView(client: MatchClient | null): MatchView | null {
  const [view, setView] = useState<MatchView | null>(null);
  useEffect(() => {
    if (!client) return;
    const unsubscribe = client.subscribe(setView);
    return () => {
      unsubscribe();
    };
  }, [client]);
  return view;
}

export function useConnectionStatus(client: MatchClient | null): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  useEffect(() => {
    if (!client) return;
    const unsubscribe = client.onStatus(setStatus);
    return () => {
      unsubscribe();
    };
  }, [client]);
  return status;
}

/**
 * Seconds left until `deadline` (server epoch ms). `serverNow` is the server's
 * clock when the view was sent, which corrects for a client clock that is off.
 */
export function useCountdown(deadline: number | null, serverNow: number): number | null {
  // Re-measured with every new view, i.e. every message from the server.
  const offset = useMemo(() => serverNow - Date.now(), [serverNow]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [deadline]);

  if (deadline === null) return null;
  return Math.max(0, (deadline - (now + offset)) / 1000);
}
