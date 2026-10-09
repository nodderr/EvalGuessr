/**
 * Match state machine: pure functions, no I/O, no timers, no clocks.
 *
 * The server owns the real MatchState for online play and feeds it the current
 * time (`now`, epoch ms). Practice mode is the same machine with one seat.
 * Every function returns a new state and never mutates its input, so the same
 * code works in a React reducer and on the server.
 *
 * Phases:  lobby -> guessing -> revealed -> guessing -> ... -> finished
 *
 * MatchState holds the answers (PositionRecord.eval_cp). Never send it to a
 * client. Send `viewFor(state, playerId)` instead, which hides the eval and
 * other players' guesses until the round is revealed.
 */
import { MATCH, TIME_CONTROLS, type TimeControl } from "./config";
import { cpToPawns, normalizeGuess } from "./evalFormat";
import { scoreGuess } from "./scoring";
import { toPublicPosition, type PositionRecord, type PositionSource, type PublicPosition } from "./types";

/** practice: 5 timed positions, solo. endless: solo, no clock, no limit. online: 1v1. */
export type MatchMode = "practice" | "endless" | "online";
export type MatchPhase = "lobby" | "guessing" | "revealed" | "finished";

export type Player = {
  id: string;
  name: string;
  connected: boolean;
};

export type PlayerRoundResult = {
  /** Locked-in guess in pawns, or null if the player ran out of time. */
  guess: number | null;
  gap: number | null;
  points: number;
  perfect: boolean;
};

export type RoundResult = {
  position: PublicPosition;
  /** Stockfish eval in pawns, White's perspective. */
  evalPawns: number;
  /** Search depth Stockfish reached for the eval. */
  depth: number;
  bestMove: string;
  /** Stockfish's main line in SAN, best move first (at least the best move). */
  line: string[];
  /** The real game the position came from, if known. Only ever sent after the reveal. */
  source: PositionSource | null;
  byPlayer: Record<string, PlayerRoundResult>;
};

export type MatchState = {
  id: string;
  mode: MatchMode;
  /** Null for endless mode: no clock. */
  timeControl: TimeControl | null;
  maxPlayers: number;
  positions: PositionRecord[];
  players: Player[];
  phase: MatchPhase;
  roundIndex: number;
  /** Epoch ms when the current round's guessing time ends. */
  roundDeadline: number | null;
  /** Guesses for the current round, keyed by player id. Secret until reveal. */
  guesses: Record<string, number>;
  /** Players who clicked "Next" after a reveal. */
  readyForNext: string[];
  results: RoundResult[];
  /** Players who asked for a rematch after the match finished. */
  rematchVotes: string[];
};

export type MatchErrorCode =
  | "MATCH_FULL"
  | "NOT_IN_LOBBY"
  | "NOT_ENOUGH_PLAYERS"
  | "NOT_GUESSING"
  | "NOT_REVEALED"
  | "UNKNOWN_PLAYER"
  | "ALREADY_GUESSED"
  | "TOO_LATE"
  | "NOT_FINISHED"
  | "NOT_ENDLESS";

export class MatchError extends Error {
  constructor(public readonly code: MatchErrorCode, message?: string) {
    super(message ?? code);
    this.name = "MatchError";
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function createMatch(opts: {
  id: string;
  mode: MatchMode;
  timeControl: TimeControl | null;
  /** For endless mode, pass the whole (shuffled) pool; it is reshuffled when used up. */
  positions: PositionRecord[];
}): MatchState {
  return {
    id: opts.id,
    mode: opts.mode,
    timeControl: opts.mode === "endless" ? null : opts.timeControl,
    maxPlayers: opts.mode === "online" ? MATCH.maxPlayers : 1,
    positions: opts.positions,
    players: [],
    phase: "lobby",
    roundIndex: 0,
    roundDeadline: null,
    guesses: {},
    readyForNext: [],
    results: [],
    rematchVotes: [],
  };
}

/**
 * Pick `count` distinct positions at random. `random` is injectable so tests
 * (and a future seeded "daily challenge") can be deterministic.
 */
export function pickPositions(
  pool: PositionRecord[],
  count: number = MATCH.positionsPerMatch,
  random: () => number = Math.random,
): PositionRecord[] {
  const copy = [...pool];
  const n = Math.min(count, copy.length);
  // Partial Fisher-Yates: shuffle only the first n slots.
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, n);
}

export function addPlayer(state: MatchState, player: { id: string; name: string }): MatchState {
  if (state.phase !== "lobby") throw new MatchError("NOT_IN_LOBBY");
  if (state.players.length >= state.maxPlayers) throw new MatchError("MATCH_FULL");
  return { ...state, players: [...state.players, { ...player, connected: true }] };
}

export function setConnected(state: MatchState, playerId: string, connected: boolean): MatchState {
  requirePlayer(state, playerId);
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, connected } : p)),
  };
}

export function isFull(state: MatchState): boolean {
  return state.players.length >= state.maxPlayers;
}

export function startMatch(state: MatchState, now: number): MatchState {
  if (state.phase !== "lobby") throw new MatchError("NOT_IN_LOBBY");
  if (!isFull(state)) throw new MatchError("NOT_ENOUGH_PLAYERS");
  return beginRound(state, 0, now);
}

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

/** Null when there is no clock (endless mode). */
export function secondsPerPosition(state: MatchState): number | null {
  return state.timeControl ? TIME_CONTROLS[state.timeControl] : null;
}

function beginRound(state: MatchState, roundIndex: number, now: number): MatchState {
  return {
    ...state,
    phase: "guessing",
    roundIndex,
    roundDeadline: secondsPerPosition(state) === null ? null : now + secondsPerPosition(state)! * 1000,
    guesses: {},
    readyForNext: [],
  };
}

/** Lock in a guess. Guesses are final: a player cannot change a locked guess. */
export function submitGuess(
  state: MatchState,
  playerId: string,
  guessPawns: number,
  now: number,
): MatchState {
  if (state.phase !== "guessing") throw new MatchError("NOT_GUESSING");
  requirePlayer(state, playerId);
  if (playerId in state.guesses) throw new MatchError("ALREADY_GUESSED");
  if (state.roundDeadline !== null && now > state.roundDeadline + MATCH.deadlineGraceMs) {
    throw new MatchError("TOO_LATE");
  }
  return { ...state, guesses: { ...state.guesses, [playerId]: normalizeGuess(guessPawns) } };
}

/** True once every player has guessed, or the deadline (plus grace) has passed. */
export function shouldReveal(state: MatchState, now: number): boolean {
  if (state.phase !== "guessing") return false;
  const everyoneGuessed = state.players.every((p) => p.id in state.guesses);
  const timeUp = state.roundDeadline !== null && now > state.roundDeadline + MATCH.deadlineGraceMs;
  return everyoneGuessed || timeUp;
}

/** Score the round and expose the eval. Players with no guess score 0. */
export function revealRound(state: MatchState): MatchState {
  if (state.phase !== "guessing") throw new MatchError("NOT_GUESSING");
  const record = state.positions[state.roundIndex]!;
  const evalPawns = cpToPawns(record.eval_cp);

  const byPlayer: Record<string, PlayerRoundResult> = {};
  for (const player of state.players) {
    const guess = state.guesses[player.id];
    if (guess === undefined) {
      byPlayer[player.id] = { guess: null, gap: null, points: 0, perfect: false };
    } else {
      const { gap, points, perfect } = scoreGuess(guess, evalPawns);
      byPlayer[player.id] = { guess, gap, points, perfect };
    }
  }

  const result: RoundResult = {
    position: toPublicPosition(record),
    evalPawns,
    depth: record.depth_reached,
    bestMove: record.best_move,
    line: record.line?.length ? record.line : [record.best_move],
    source: record.source ?? null,
    byPlayer,
  };
  return { ...state, phase: "revealed", roundDeadline: null, results: [...state.results, result] };
}

/** A player clicked "Next". Advances once every connected player is ready. */
export function markReady(state: MatchState, playerId: string, now: number): MatchState {
  if (state.phase !== "revealed") throw new MatchError("NOT_REVEALED");
  requirePlayer(state, playerId);
  const readyForNext = state.readyForNext.includes(playerId)
    ? state.readyForNext
    : [...state.readyForNext, playerId];
  const next = { ...state, readyForNext };
  const allReady = next.players.filter((p) => p.connected).every((p) => readyForNext.includes(p.id));
  return allReady ? advance(next, now) : next;
}

/** Move to the next round, or finish. The server also calls this on its auto-advance timer. */
export function advance(state: MatchState, now: number): MatchState {
  if (state.phase !== "revealed") throw new MatchError("NOT_REVEALED");
  const nextIndex = state.roundIndex + 1;
  if (state.mode === "endless") {
    // Never runs out: when the queue is used up, append a reshuffle of the same positions.
    const positions = nextIndex < state.positions.length ? state.positions : refill(state.positions);
    return beginRound({ ...state, positions }, nextIndex, now);
  }
  if (nextIndex >= state.positions.length) {
    return { ...state, phase: "finished", readyForNext: [] };
  }
  return beginRound(state, nextIndex, now);
}

/** Append one more shuffled pass over the distinct positions, never repeating the last one immediately. */
function refill(queue: PositionRecord[]): PositionRecord[] {
  const distinct = [...new Map(queue.map((p) => [p.id, p])).values()];
  const next = pickPositions(distinct, distinct.length);
  const last = queue[queue.length - 1];
  if (next.length > 1 && last && next[0]!.id === last.id) [next[0], next[1]] = [next[1]!, next[0]!];
  return [...queue, ...next];
}

/**
 * Endless mode: stop and go to the summary. An unanswered current round is
 * dropped, so the summary only counts positions the player actually played.
 */
export function finishEndless(state: MatchState): MatchState {
  if (state.mode !== "endless") throw new MatchError("NOT_ENDLESS");
  if (state.phase === "finished") return state;
  return { ...state, phase: "finished", roundDeadline: null, guesses: {}, readyForNext: [] };
}

/** A player asked for a rematch. The server starts a new match once every connected player has. */
export function requestRematch(state: MatchState, playerId: string): MatchState {
  if (state.phase !== "finished") throw new MatchError("NOT_FINISHED");
  requirePlayer(state, playerId);
  if (state.rematchVotes.includes(playerId)) return state;
  return { ...state, rematchVotes: [...state.rematchVotes, playerId] };
}

export function everyoneWantsRematch(state: MatchState): boolean {
  return state.players.filter((p) => p.connected).every((p) => state.rematchVotes.includes(p.id));
}

/**
 * A fresh match for the same players (same code, new positions), started immediately.
 * Used for rematches; ids and names carry over so seats and rejoin tokens stay valid.
 */
export function rematch(state: MatchState, positions: PositionRecord[], now: number): MatchState {
  const fresh = createMatch({ id: state.id, mode: state.mode, timeControl: state.timeControl, positions });
  return startMatch({ ...fresh, players: state.players }, now);
}

export function totals(state: MatchState): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(state.players.map((p) => [p.id, 0]));
  for (const round of state.results) {
    for (const [id, r] of Object.entries(round.byPlayer)) out[id] = (out[id] ?? 0) + r.points;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Client view
// ---------------------------------------------------------------------------

/** The only shape of match data that is ever sent to a client. */
export type MatchView = {
  id: string;
  mode: MatchMode;
  timeControl: TimeControl | null;
  /** Null in endless mode (no clock). */
  secondsPerPosition: number | null;
  phase: MatchPhase;
  /** The viewing player's id. */
  you: string;
  maxPlayers: number;
  players: (Player & { score: number; hasGuessed: boolean; readyForNext: boolean; wantsRematch: boolean })[];
  roundIndex: number;
  /** Null in endless mode (no limit). */
  totalRounds: number | null;
  /** Current position without its eval. Null in the lobby and once finished. */
  position: PublicPosition | null;
  /** Epoch ms (server clock). Pair with serverNow to correct for clock skew. */
  roundDeadline: number | null;
  serverNow: number;
  /** Your own locked guess for this round, if any. Opponents' guesses stay hidden until reveal. */
  yourGuess: number | null;
  /** All revealed rounds so far; the last one is the current reveal when phase is "revealed". */
  results: RoundResult[];
};

export function viewFor(state: MatchState, playerId: string, now: number): MatchView {
  const scores = totals(state);
  const showPosition = state.phase === "guessing" || state.phase === "revealed";
  const record = state.positions[state.roundIndex];
  return {
    id: state.id,
    mode: state.mode,
    timeControl: state.timeControl,
    secondsPerPosition: secondsPerPosition(state),
    phase: state.phase,
    you: playerId,
    maxPlayers: state.maxPlayers,
    players: state.players.map((p) => ({
      ...p,
      score: scores[p.id] ?? 0,
      hasGuessed: p.id in state.guesses,
      readyForNext: state.readyForNext.includes(p.id),
      wantsRematch: state.rematchVotes.includes(p.id),
    })),
    roundIndex: state.roundIndex,
    totalRounds: state.mode === "endless" ? null : state.positions.length,
    position: showPosition && record ? toPublicPosition(record) : null,
    roundDeadline: state.roundDeadline,
    serverNow: now,
    yourGuess: state.guesses[playerId] ?? null,
    results: state.results,
  };
}

function requirePlayer(state: MatchState, playerId: string): void {
  if (!state.players.some((p) => p.id === playerId)) throw new MatchError("UNKNOWN_PLAYER");
}
