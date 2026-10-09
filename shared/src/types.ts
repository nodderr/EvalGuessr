/**
 * Core data types.
 *
 * PositionRecord carries the answer (eval_cp) and must stay on the server.
 * Clients only ever receive PublicPosition until a round is revealed.
 */

/**
 * Where a position came from: a real Lichess game (scripts/fetch_lichess_positions.py).
 * Revealed with the eval, never before: ratings and the result can hint at the answer.
 */
export type PositionSource = {
  site: "lichess";
  game_id: string;
  /** Half-moves played before this position. */
  ply: number;
  move_number: number;
  white_elo: number;
  black_elo: number;
  speed: string;
  /** Lichess format, seconds+increment, e.g. "180+2". */
  time_control: string;
  /** "YYYY-MM" */
  month: string;
  opening: string;
  /** "1-0", "0-1" or "1/2-1/2" */
  result: string;
};

/** One entry of server/data/positions.json, as written by scripts/generate_positions.py. */
export type PositionRecord = {
  id: number;
  fen: string;
  side_to_move: "white" | "black";
  /** Centipawns from White's perspective. Secret until reveal. */
  eval_cp: number;
  depth_reached: number;
  best_move: string;
  /** Stockfish's main line from this position in SAN, best move first. Older data may lack it. */
  line?: string[];
  /** The real game this position is from, if any. */
  source?: PositionSource;
};

/** What a player sees while guessing: no eval, no best move. */
export type PublicPosition = {
  id: number;
  fen: string;
  side_to_move: "white" | "black";
};

export function toPublicPosition(p: PositionRecord): PublicPosition {
  return { id: p.id, fen: p.fen, side_to_move: p.side_to_move };
}
