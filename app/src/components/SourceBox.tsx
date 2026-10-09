import { ArrowSquareOut, Fire, HourglassMedium, Lightning, Timer, type Icon } from "@phosphor-icons/react";
import type { PositionSource } from "@eval-guess/shared";

const SPEED_ICON: Record<string, Icon> = { Bullet: Lightning, Blitz: Fire, Rapid: HourglassMedium, Classical: Timer };
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

/** One side of the game, Lichess-style: colour dot, side, rating; the winner in bold. */
function SideRow({ side, elo, won }: { side: "white" | "black"; elo: number; won: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden
        className={`size-2.5 rounded-full border border-ink/40 ${side === "white" ? "bg-[#f7f7f2]" : "bg-[#262522]"}`}
      />
      <span className={won ? "font-semibold" : ""}>{side === "white" ? "White" : "Black"}</span>
      <span className="font-mono text-ink-muted tabular-nums">{elo}</span>
    </li>
  );
}

/**
 * Where the position came from, laid out like Lichess's game-info box.
 * Shown only after the reveal: ratings and the result could hint at the eval.
 */
export function SourceBox({ source, sideToMove }: { source: PositionSource; sideToMove: "white" | "black" }) {
  const SpeedIcon = SPEED_ICON[source.speed] ?? Timer;
  const result = source.result === "1-0" ? "white" : source.result === "0-1" ? "black" : null;
  const resultText = result ? `${source.result} · ${result === "white" ? "White" : "Black"} won` : `${source.result.replace("1/2", "½")} · Draw`;

  return (
    <section aria-label="Source game" className="grid gap-2.5 border-t border-line pt-3 text-sm">
      <div className="flex items-center gap-2.5">
        <SpeedIcon size={22} weight="duotone" className="shrink-0 text-ink-muted" aria-hidden />
        <div className="grid leading-tight">
          <span>
            {clock(source.time_control)} · Rated · {source.speed}
          </span>
          <span className="text-xs text-ink-muted">{month(source.month)}</span>
        </div>
        <a
          href={gameUrl(source, sideToMove)}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1 text-ink-muted underline-offset-4 hover:text-accent hover:underline"
        >
          lichess.org
          <ArrowSquareOut size={14} weight="bold" aria-hidden />
        </a>
      </div>

      <ul className="grid gap-1 pl-[34px]">
        <SideRow side="white" elo={source.white_elo} won={result === "white"} />
        <SideRow side="black" elo={source.black_elo} won={result === "black"} />
      </ul>

      <div className="grid gap-0.5 pl-[34px] text-ink-muted">
        {source.opening && <span>{source.opening}</span>}
        <span>
          Move {source.move_number} · {resultText}
        </span>
      </div>
    </section>
  );
}
