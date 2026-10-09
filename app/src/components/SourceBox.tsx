import { ArrowSquareOut } from "@phosphor-icons/react";
import type { PositionSource } from "@eval-guess/shared";

const RESULT: Record<string, string> = { "1-0": "White won", "0-1": "Black won", "1/2-1/2": "Draw" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Lichess clock to the usual notation: "180+2" -> "3+2", "45+0" -> "45s+0". */
function clock(tc: string): string {
  const [base, inc] = tc.split("+").map(Number);
  if (base === undefined || Number.isNaN(base)) return tc;
  const b = base >= 60 && base % 60 === 0 ? `${base / 60}` : `${base}s`;
  return `${b}+${inc ?? 0}`;
}

/** "2026-09" -> "Sep 2026" */
function month(m: string): string {
  const [y, mo] = m.split("-");
  const name = MONTHS[Number(mo) - 1];
  return name && y ? `${name} ${y}` : m;
}

/** Link to the exact move on Lichess, from the side to move's point of view. */
function gameUrl(s: PositionSource, sideToMove: "white" | "black"): string {
  return `https://lichess.org/${s.game_id}${sideToMove === "black" ? "/black" : ""}#${s.ply}`;
}

/** Where the position came from. Shown only after the reveal (the result could hint at the eval). */
export function SourceBox({ source, sideToMove }: { source: PositionSource; sideToMove: "white" | "black" }) {
  return (
    <div className="grid gap-1 rounded-xl border border-line px-4 py-3 text-sm">
      <span className="text-ink-muted">From a real Lichess game</span>
      <span>
        White {source.white_elo} vs Black {source.black_elo}
        <span className="text-ink-muted">
          {" "}
          · {source.speed} {clock(source.time_control)} · {month(source.month)}
        </span>
      </span>
      {source.opening && (
        <span>
          {source.opening}
          <span className="text-ink-muted"> · move {source.move_number}</span>
        </span>
      )}
      <span className="flex items-center justify-between gap-3">
        <span>{RESULT[source.result] ?? source.result}</span>
        <a
          href={gameUrl(source, sideToMove)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 font-medium text-accent underline-offset-4 hover:underline"
        >
          View game
          <ArrowSquareOut size={16} weight="bold" aria-hidden />
        </a>
      </span>
    </div>
  );
}
