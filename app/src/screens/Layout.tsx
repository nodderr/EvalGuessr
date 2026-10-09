import type { ReactNode } from "react";

/**
 * Page frame. Board-and-panel screens use `split`: one column on phones and
 * tablets, board left and panel right from the lg breakpoint. Split screens
 * are wide so the board can grow; see BOARD_COLUMN.
 */
export function Screen({ children, split = false }: { children: ReactNode; split?: boolean }) {
  return (
    <main
      className={`mx-auto min-h-[100dvh] w-full px-4 pt-4 pb-8 sm:px-6 sm:pt-6 ${split ? "max-w-[1600px]" : "max-w-5xl"}`}
    >
      {split ? (
        <div className="grid gap-5 lg:grid-cols-[auto_minmax(320px,420px)] lg:items-start lg:justify-center lg:gap-10">
          {children}
        </div>
      ) : (
        children
      )}
    </main>
  );
}

/**
 * Width of the board column (board + eval bar, ~52px). The board is as big as
 * the screen allows:
 *   phones/tablets: full width, but leave ~290px of height for the controls below
 *   desktop (lg+):  as tall as the window allows, leaving room for the side panel
 */
export const BOARD_COLUMN =
  "mx-auto grid w-full gap-3 max-w-[max(300px,calc(100dvh-290px))] lg:mx-0 lg:max-w-none lg:w-[min(calc(100dvh-100px),calc(100vw-540px))]";

/** Thin top bar: back action on the left, optional status on the right. */
export function TopBar({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex min-h-11 items-center justify-between gap-3 lg:col-span-2">
      <div className="flex items-center gap-3">{left}</div>
      <div className="flex items-center gap-4">{right}</div>
    </header>
  );
}
