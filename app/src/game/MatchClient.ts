/**
 * The game state layer's public face. Screens talk only to a MatchClient and
 * render only the MatchView it emits, never raw match state. The server owns
 * the real state; this is a thin, typed remote control for it.
 */
import type { MatchMode, MatchView, TimeControl } from "@eval-guess/shared";

export type CreateMatchOptions = {
  mode: MatchMode;
  timeControl: TimeControl;
  name: string;
};

/**
 * connecting:   first connection attempt
 * waking:       first attempt is slow (Render free instance starting up)
 * connected
 * reconnecting: lost the connection, retrying (the seat is held for 30s)
 */
export type ConnectionStatus = "connecting" | "waking" | "connected" | "reconnecting";

export type AbandonReason = "opponent_left" | "opponent_timeout";

export interface MatchClient {
  /** Called with a fresh view after every change. Returns an unsubscribe function. */
  subscribe(listener: (view: MatchView | null) => void): () => void;
  onStatus(listener: (status: ConnectionStatus) => void): () => void;
  onAbandoned(listener: (reason: AbandonReason) => void): () => void;

  create(opts: CreateMatchOptions): Promise<void>;
  /** Join an online match by its code. */
  join(matchId: string, name: string): Promise<void>;
  /** Re-attach to the seat saved in this tab, if any. Resolves false if there is nothing to resume. */
  resume(): Promise<boolean>;
  /** Lock in a guess in pawns (White's perspective). Rejects if it is too late or already locked. */
  submitGuess(guess: number): Promise<void>;
  /** "Next position" after a reveal. */
  ready(): Promise<void>;
  /** Ask for a rematch after an online match. */
  rematch(): Promise<void>;
  leave(): void;
}
