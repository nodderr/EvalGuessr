import { defaultPieces } from "react-chessboard";
import type { PieceKind, SideMaterial } from "./material";

type Props = {
  side: "white" | "black";
  material: SideMaterial;
  toMove: boolean;
};

/**
 * chess.com-style strip above or below the board: the side, the opponent
 * pieces it has captured (same kinds overlap), and its material lead.
 */
export function MaterialBar({ side, material, toMove }: Props) {
  const capturedColor = side === "white" ? "b" : "w";
  // Group by kind so identical pieces can overlap, as on chess.com.
  const groups = material.captured.reduce<{ kind: PieceKind; n: number }[]>((acc, k) => {
    const last = acc[acc.length - 1];
    if (last && last.kind === k) last.n++;
    else acc.push({ kind: k, n: 1 });
    return acc;
  }, []);

  return (
    <div className="flex h-7 min-w-0 items-center gap-2 text-sm">
      <span
        aria-hidden
        className={`size-3 shrink-0 rounded-[3px] border border-ink/40 ${side === "white" ? "bg-[#f7f7f2]" : "bg-[#262522]"}`}
      />
      <span className="font-medium">{side === "white" ? "White" : "Black"}</span>
      {toMove && (
        <span className="rounded bg-accent px-1.5 py-px text-xs font-semibold text-accent-ink">to move</span>
      )}
      <span className="flex min-w-0 items-center gap-1 overflow-hidden" aria-label={`${side} captured ${material.captured.join(" ") || "nothing"}`}>
        {groups.map(({ kind, n }, gi) => {
          const Piece = defaultPieces[`${capturedColor}${kind.toUpperCase()}`];
          return (
            <span key={gi} className="flex shrink-0">
              {Array.from({ length: n }, (_, i) => (
                <span key={i} className={i > 0 ? "-ml-2.5" : ""} aria-hidden>
                  {Piece?.({ svgStyle: { width: 18, height: 18, display: "block" } })}
                </span>
              ))}
            </span>
          );
        })}
      </span>
      {material.advantage > 0 && (
        <span className="shrink-0 font-mono text-xs font-semibold text-ink-muted tabular-nums">+{material.advantage}</span>
      )}
    </div>
  );
}
