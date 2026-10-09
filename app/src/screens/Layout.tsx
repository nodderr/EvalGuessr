import type { ReactNode } from "react";

/**
 * Page frame. Board-and-panel screens use `split`: one column on phones and
 * tablets, board left and panel right from the lg breakpoint. Split screens
 * are wide so the board can grow; see BOARD_COLUMN.
 */
export function Screen({ children, split = false }: { children: ReactNode; split?: boolean }) {
  return (
    <main
      className={`mx-auto min-h-[100dvh] w-full pt-4 pb-8 sm:px-6 sm:pt-6 ${
        split ? "max-w-[1600px] px-3 lg:py-6" : "max-w-5xl px-4"
      }`}
    >
      {split ? (
        <div className="grid gap-5 lg:grid-cols-[auto_minmax(340px,400px)] lg:items-start lg:justify-center lg:gap-10">
          {children}
        </div>
      ) : (
        children
      )}
    </main>
  );
}

/**
 * Width of the board column (board + eval bar + gap, 56px on desktop). The
 * board is square, so its width also sets the height of the column, which is
 * the board plus two 28px material bars and their 6px gaps (68px).
 *   phones/tablets: full width, but leave room for the controls below
 *   desktop (lg+):  the full window height minus 48px of page padding:
 *                   width = (100dvh - 48 - 68) + 56 = 100dvh - 60px
 */
export const BOARD_COLUMN =
  "mx-auto grid w-full gap-3 max-w-[max(300px,calc(100dvh-330px))] lg:mx-0 lg:max-w-none lg:w-[min(calc(100dvh-60px),calc(100vw-510px))]";

/**
 * Right-hand column on desktop. On phones it dissolves (display: contents) so
 * its children flow in the page's single column; put the TopBar first with
 * `order-first lg:order-none` so it still sits above the board there.
 */
export const SIDE_COLUMN = "contents lg:grid lg:content-start lg:gap-5";

/**
 * The match side panel (chess.com / Lichess style). On desktop: one card,
 * as tall as the board column, with a scrolling middle and the action
 * buttons pinned at the bottom. On phones it dissolves into the page's
 * single column; its header goes first (order-first) and the actions stick
 * to the bottom of the screen.
 */
export const PANEL = {
  root: "contents lg:sticky lg:top-6 lg:flex lg:h-[calc(100dvh-48px)] lg:flex-col lg:overflow-hidden lg:rounded-xl lg:border lg:border-line lg:bg-surface-raised",
  body: "grid content-start gap-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-4 lg:py-4",
  footer:
    "sticky bottom-0 z-10 -mx-3 grid gap-2 border-t border-line bg-surface/95 px-3 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:bg-transparent lg:px-4 lg:backdrop-blur-none",
};

/** Thin top bar: back action on the left, optional status on the right. */
export function TopBar({ left, right, className = "lg:col-span-2" }: { left?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <header className={`flex min-h-11 items-center justify-between gap-3 ${className}`}>
      <div className="flex items-center gap-3">{left}</div>
      <div className="flex items-center gap-4">{right}</div>
    </header>
  );
}
