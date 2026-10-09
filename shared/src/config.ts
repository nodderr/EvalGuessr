/**
 * Every tunable game number lives here, so the app and the server always agree.
 */

/** Scoring curve: full points inside the perfect window, then linear down to 0. */
export const SCORING = {
  /** Gap (in pawns) at or below which a guess scores full points. */
  perfectWindow: 1.0,
  /** Gap (in pawns) at or beyond which a guess scores 0. */
  zeroAt: 4.0,
  /** Points for a perfect guess. */
  maxPoints: 100,
} as const;

export type ScoringConfig = {
  perfectWindow: number;
  zeroAt: number;
  maxPoints: number;
};

/** Range of the eval slider, in pawns from White's perspective. */
export const EVAL_RANGE = { min: -10, max: 10 } as const;

/** Seconds a player gets to guess each position. */
export const TIME_CONTROLS = {
  bullet: 10,
  blitz: 30,
  rapid: 60,
} as const;

export type TimeControl = keyof typeof TIME_CONTROLS;

export const MATCH = {
  positionsPerMatch: 5,
  /** Seats in an online match. Practice uses 1. Raise this for 3+ player rooms. */
  maxPlayers: 2,
  /**
   * Extra milliseconds the server waits after a round's deadline before closing it,
   * so a guess auto-submitted by the client at 0:00 still arrives over a slow network.
   */
  deadlineGraceMs: 1500,
  /** Online only: after a reveal, move to the next position this long after it, even if someone hasn't clicked Next. */
  revealAutoAdvanceMs: 10_000,
  /**
   * How long a disconnected player's seat is held (e.g. after closing the tab)
   * before the match is called off. Online is shorter because the opponent is waiting.
   */
  reconnectGraceMs: 60_000,
  /** Same, for practice and endless, where nobody is waiting. */
  soloReconnectGraceMs: 10 * 60_000,
} as const;
