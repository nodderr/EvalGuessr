/**
 * RoomManager: owns every live match and is the only thing that changes one.
 *
 * It wraps the pure state machine from @eval-guess/shared with what the pure
 * code deliberately leaves out: the clock (round deadlines, auto-advance),
 * connections (who is online, reconnect windows), seat secrets, and cleanup.
 *
 * It knows nothing about Socket.IO. It talks to clients through `send`, so it
 * can be tested with fake timers and no network.
 */
import {
  MATCH,
  MatchError,
  addPlayer,
  advance,
  createMatch,
  everyoneWantsRematch,
  finishEndless,
  isFull,
  markReady,
  pickPositions,
  rematch,
  requestRematch,
  revealRound,
  setConnected,
  shouldReveal,
  startMatch,
  submitGuess,
  viewFor,
  type ErrorCode,
  type MatchMode,
  type MatchState,
  type PositionRecord,
  type Seat,
  type ServerToClientEvents,
  type TimeControl,
} from "@eval-guess/shared";
import { newMatchCode, newPlayerId, newToken } from "./ids";

/** Delivers one server event to one connection. */
export type Send = <E extends keyof ServerToClientEvents>(
  connectionId: string,
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
) => void;

/** A request the manager refuses, with a code the client can act on. */
export class RoomError extends Error {
  constructor(public readonly code: ErrorCode) {
    super(code);
  }
}

export const ROOM_LIMITS = {
  /** Hard cap on live rooms, to bound memory on a small instance. */
  maxRooms: 2000,
  /** A lobby nobody joins is closed after this long. */
  lobbyTtlMs: 30 * 60 * 1000,
  /** A finished match stays around this long for rematches. */
  finishedTtlMs: 10 * 60 * 1000,
};

type Room = {
  state: MatchState;
  /** playerId -> secret rejoin token */
  tokens: Map<string, string>;
  /** playerId -> current connection id, or null while disconnected */
  connections: Map<string, string | null>;
  phaseTimer: ReturnType<typeof setTimeout> | null;
  ttlTimer: ReturnType<typeof setTimeout> | null;
  dropTimers: Map<string, ReturnType<typeof setTimeout>>;
};

export class RoomManager {
  private rooms = new Map<string, Room>();

  constructor(
    private readonly pool: PositionRecord[],
    private readonly send: Send,
  ) {}

  get size(): number {
    return this.rooms.size;
  }

  // -------------------------------------------------------------------------
  // Seats
  // -------------------------------------------------------------------------

  create(connectionId: string, req: { mode: MatchMode; timeControl: TimeControl | null; name: string }): Seat {
    if (this.rooms.size >= ROOM_LIMITS.maxRooms) throw new RoomError("SERVER_BUSY");
    const id = newMatchCode((code) => this.rooms.has(code));
    const room: Room = {
      state: createMatch({
        id,
        mode: req.mode,
        timeControl: req.timeControl,
        // Endless works through the whole pool (reshuffled as it goes); other modes take 5.
        positions: req.mode === "endless" ? pickPositions(this.pool, this.pool.length) : pickPositions(this.pool),
      }),
      tokens: new Map(),
      connections: new Map(),
      phaseTimer: null,
      ttlTimer: null,
      dropTimers: new Map(),
    };
    this.rooms.set(id, room);
    const seat = this.seatPlayer(room, connectionId, req.name);
    if (!isFull(room.state)) this.setTtl(room, ROOM_LIMITS.lobbyTtlMs); // waiting for an opponent
    return seat;
  }

  join(connectionId: string, req: { matchId: string; name: string }): Seat {
    const room = this.room(req.matchId);
    if (room.state.mode !== "online") throw new RoomError("MATCH_NOT_FOUND");
    return this.seatPlayer(room, connectionId, req.name);
  }

  /** Re-attach a seat to a new connection. The token proves the seat is yours. */
  rejoin(connectionId: string, seat: Seat): Seat {
    const room = this.room(seat.matchId);
    if (room.tokens.get(seat.playerId) !== seat.token) throw new RoomError("NOT_IN_MATCH");
    clearTimeout(room.dropTimers.get(seat.playerId));
    room.dropTimers.delete(seat.playerId);
    room.connections.set(seat.playerId, connectionId);
    this.update(room, setConnected(room.state, seat.playerId, true));
    return seat;
  }

  private seatPlayer(room: Room, connectionId: string, name: string): Seat {
    const playerId = newPlayerId();
    const token = newToken();
    let state = addPlayer(room.state, { id: playerId, name });
    room.tokens.set(playerId, token);
    room.connections.set(playerId, connectionId);
    if (isFull(state)) {
      this.clearTtl(room);
      state = startMatch(state, Date.now());
    }
    this.update(room, state);
    return { matchId: room.state.id, playerId, token };
  }

  // -------------------------------------------------------------------------
  // Game actions (the caller has already resolved the connection to a seat)
  // -------------------------------------------------------------------------

  submitGuess(seat: Pick<Seat, "matchId" | "playerId">, guess: number): void {
    const room = this.room(seat.matchId);
    const now = Date.now();
    let state = submitGuess(room.state, seat.playerId, guess, now);
    if (shouldReveal(state, now)) state = revealRound(state); // everyone is in: no need to wait for the clock
    this.update(room, state);
  }

  ready(seat: Pick<Seat, "matchId" | "playerId">): void {
    const room = this.room(seat.matchId);
    this.update(room, markReady(room.state, seat.playerId, Date.now()));
  }

  requestRematch(seat: Pick<Seat, "matchId" | "playerId">): void {
    const room = this.room(seat.matchId);
    let state = requestRematch(room.state, seat.playerId);
    if (everyoneWantsRematch(state)) state = rematch(state, pickPositions(this.pool), Date.now());
    this.update(room, state);
  }

  /** Endless mode: stop and show the summary. */
  finish(seat: Pick<Seat, "matchId" | "playerId">): void {
    const room = this.room(seat.matchId);
    this.update(room, finishEndless(room.state));
  }

  /** Explicit leave: the match ends for everyone. */
  leave(seat: Pick<Seat, "matchId" | "playerId">): void {
    const room = this.rooms.get(seat.matchId);
    if (!room) return;
    this.notifyOthers(room, seat.playerId, "opponent_left");
    this.close(room);
  }

  /** A connection dropped. Hold the seat for a while before calling the match off. */
  disconnected(seat: Pick<Seat, "matchId" | "playerId">, connectionId: string): void {
    const room = this.rooms.get(seat.matchId);
    // Ignore a stale connection: the player may already have rejoined on a new one.
    if (!room || room.connections.get(seat.playerId) !== connectionId) return;
    room.connections.set(seat.playerId, null);
    this.update(room, setConnected(room.state, seat.playerId, false));

    room.dropTimers.set(
      seat.playerId,
      setTimeout(() => {
        this.notifyOthers(room, seat.playerId, "opponent_timeout");
        this.close(room);
      }, room.state.mode === "online" ? MATCH.reconnectGraceMs : MATCH.soloReconnectGraceMs),
    );
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private room(matchId: string): Room {
    const room = this.rooms.get(matchId);
    if (!room) throw new RoomError("MATCH_NOT_FOUND");
    return room;
  }

  /** The single place state changes: store it, re-arm the clock, tell everyone. */
  private update(room: Room, state: MatchState): void {
    const phaseChanged = state.phase !== room.state.phase || state.roundIndex !== room.state.roundIndex;
    room.state = state;
    if (phaseChanged || room.phaseTimer === null) this.armPhaseTimer(room);
    this.broadcast(room);
  }

  /** Each phase has at most one pending timer: close the round, or auto-advance. */
  private armPhaseTimer(room: Room): void {
    if (room.phaseTimer) clearTimeout(room.phaseTimer);
    room.phaseTimer = null;
    const { state } = room;
    // A match in progress (including a rematch of a finished one) has no expiry.
    if (state.phase === "guessing" || state.phase === "revealed") this.clearTtl(room);

    if (state.phase === "guessing" && state.roundDeadline !== null) {
      // Fire just after deadline + grace, when shouldReveal() is guaranteed true.
      const delay = state.roundDeadline + MATCH.deadlineGraceMs + 5 - Date.now();
      room.phaseTimer = setTimeout(() => {
        room.phaseTimer = null;
        if (shouldReveal(room.state, Date.now())) this.update(room, revealRound(room.state));
      }, Math.max(0, delay));
    } else if (state.phase === "revealed" && state.mode === "online") {
      // Online only: don't let one idle player stall the match. Practice waits for the click.
      room.phaseTimer = setTimeout(() => {
        room.phaseTimer = null;
        if (room.state.phase === "revealed") this.update(room, advance(room.state, Date.now()));
      }, MATCH.revealAutoAdvanceMs);
    } else if (state.phase === "finished") {
      this.setTtl(room, ROOM_LIMITS.finishedTtlMs);
    }
  }

  private broadcast(room: Room): void {
    const now = Date.now();
    for (const [playerId, connectionId] of room.connections) {
      if (connectionId) this.send(connectionId, "match:state", viewFor(room.state, playerId, now));
    }
  }

  private notifyOthers(room: Room, playerId: string, reason: "opponent_left" | "opponent_timeout"): void {
    if (room.state.mode !== "online") return;
    for (const [id, connectionId] of room.connections) {
      if (id !== playerId && connectionId) this.send(connectionId, "match:abandoned", { reason });
    }
  }

  private setTtl(room: Room, ms: number): void {
    this.clearTtl(room);
    room.ttlTimer = setTimeout(() => this.close(room), ms);
  }

  private clearTtl(room: Room): void {
    if (room.ttlTimer) clearTimeout(room.ttlTimer);
    room.ttlTimer = null;
  }

  private close(room: Room): void {
    if (room.phaseTimer) clearTimeout(room.phaseTimer);
    this.clearTtl(room);
    room.dropTimers.forEach((t) => clearTimeout(t));
    this.rooms.delete(room.state.id);
  }

  /** Stop every timer (tests and graceful shutdown). */
  closeAll(): void {
    [...this.rooms.values()].forEach((r) => this.close(r));
  }
}

/** Map anything thrown by the manager or state machine to a client-facing error code. */
export function errorCode(err: unknown): ErrorCode | null {
  if (err instanceof RoomError || err instanceof MatchError) return err.code;
  return null;
}
