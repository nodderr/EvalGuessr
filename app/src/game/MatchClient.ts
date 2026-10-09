/**
 * The game state layer's public face. Screens talk only to a MatchClient and
 * render only the MatchView it emits, never the raw MatchState.
 *
 * Implementations:
 *   - LocalMatchClient: runs the shared match state machine in the browser (practice, dev only).
 *   - SocketMatchClient (Step 5): forwards the same calls to the game server over Socket.IO.
 */
import type { MatchMode, MatchView, TimeControl } from "@eval-guess/shared";

export type CreateMatchOptions = {
  mode: MatchMode;
  timeControl: TimeControl;
  name: string;
};

export interface MatchClient {
  /** Called with a fresh view after every change. Returns an unsubscribe function. */
  subscribe(listener: (view: MatchView) => void): () => void;
  create(opts: CreateMatchOptions): Promise<void>;
  /** Lock in a guess in pawns (White's perspective). Rejects if it is too late or already locked. */
  submitGuess(guess: number): Promise<void>;
  /** "Next position" after a reveal. */
  ready(): Promise<void>;
  leave(): void;
}
