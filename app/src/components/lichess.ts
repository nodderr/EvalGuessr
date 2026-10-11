import type { PositionSource, PublicPosition } from "@eval-guess/shared";

/** The source game on Lichess at the exact move, from the side to move's point of view. */
export function gameUrl(source: PositionSource, sideToMove: "white" | "black"): string {
  return `https://lichess.org/${source.game_id}${sideToMove === "black" ? "/black" : ""}#${source.ply}`;
}

/** A position on Lichess: its source game when known, otherwise the analysis board for the FEN. */
export function lichessUrl(position: PublicPosition, source: PositionSource | null): string {
  if (source) return gameUrl(source, position.side_to_move);
  const color = position.side_to_move === "black" ? "?color=black" : "";
  return `https://lichess.org/analysis/standard/${position.fen.replace(/ /g, "_")}${color}`;
}
