/**
 * Core data types.
 *
 * PositionRecord carries the answer (eval_cp) and must stay on the server.
 * Clients only ever receive PublicPosition until a round is revealed.
 */

/** One entry of server/data/positions.json, as written by scripts/generate_positions.py. */
export type PositionRecord = {
  id: number;
  fen: string;
  side_to_move: "white" | "black";
  /** Centipawns from White's perspective. Secret until reveal. */
  eval_cp: number;
  depth_reached: number;
  best_move: string;
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
