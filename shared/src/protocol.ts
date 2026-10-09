/**
 * Socket.IO protocol between the app and the game server.
 *
 * The server pushes the full MatchView after every change ("match:state"),
 * rather than deltas: simpler, and a reconnecting client is back in sync from
 * one message. Client actions use Socket.IO acknowledgements to report errors.
 *
 * Practice mode uses the same events with mode "practice" (one seat), so the
 * eval is never in the browser before a guess is locked in, in any mode.
 */
import type { TimeControl } from "./config";
import type { MatchErrorCode, MatchMode, MatchView } from "./match";

export type ErrorCode =
  | MatchErrorCode
  | "MATCH_NOT_FOUND"
  | "INVALID_REQUEST"
  | "NOT_IN_MATCH"
  | "SERVER_BUSY";

export type Ack<T> =
  | { ok: true; data: T }
  | { ok: false; error: ErrorCode; message?: string };

/**
 * Returned on create/join. Keep it (e.g. in sessionStorage) to rejoin after a
 * reconnect or page reload. `token` is a secret: player ids are visible to
 * other players, so the token is what proves a rejoin is really you.
 */
export type Seat = { matchId: string; playerId: string; token: string };

export interface ClientToServerEvents {
  /** Create a match. Practice matches start immediately; online matches wait for an opponent. */
  "match:create": (
    req: { mode: MatchMode; timeControl: TimeControl; name: string },
    ack: (res: Ack<Seat>) => void,
  ) => void;
  /** Join an online match by its code. The match starts as soon as it is full. */
  "match:join": (req: { matchId: string; name: string }, ack: (res: Ack<Seat>) => void) => void;
  /** Re-attach to a seat after a dropped connection or page reload. */
  "match:rejoin": (req: Seat, ack: (res: Ack<Seat>) => void) => void;
  /** Lock in a guess (pawns, White's perspective). Final: cannot be changed. */
  "guess:submit": (req: { guess: number }, ack: (res: Ack<null>) => void) => void;
  /** "Next position" after a reveal. */
  "round:ready": (ack: (res: Ack<null>) => void) => void;
  /** Ask for a rematch after the match finishes. Starts when every connected player has asked. */
  "match:rematch": (ack: (res: Ack<null>) => void) => void;
  /** Leave the current match. */
  "match:leave": () => void;
}

export interface ServerToClientEvents {
  "match:state": (view: MatchView) => void;
  /** The opponent left, or did not come back in time; the match is over. */
  "match:abandoned": (info: { reason: "opponent_left" | "opponent_timeout" }) => void;
}
