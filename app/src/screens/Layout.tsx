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
 * Width of the board column (board + eval bar + gap, 56px on desktop).
 * The board is as big as the screen allows:
 *   phones/tablets: full width, but leave ~290px of height for the controls below
 *   desktop (lg+):  the full window height (minus 48px of page padding), with the
 *                   header and controls in the side panel (see SIDE_COLUMN)
 */
export const BOARD_COLUMN =
  "mx-auto grid w-full gap-3 max-w-[max(300px,calc(100dvh-290px))] lg:mx-0 lg:max-w-none lg:w-[min(calc(100dvh+8px),calc(100vw-510px))]";

/**
 * Right-hand column on desktop. On phones it dissolves (display: contents) so
 * its children flow in the page's single column; put the TopBar first with
 * `order-first lg:order-none` so it still sits above the board there.
 */
export const SIDE_COLUMN = "contents lg:grid lg:content-start lg:gap-5";

/** Thin top bar: back action on the left, optional status on the right. */
export function TopBar({ left, right, className = "lg:col-span-2" }: { left?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <header className={`flex min-h-11 items-center justify-between gap-3 ${className}`}>
      <div className="flex items-center gap-3">{left}</div>
      <div className="flex items-center gap-4">{right}</div>
    </header>
  );
}
