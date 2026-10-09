import type { ReactNode } from "react";

/**
 * Page frame. Board-and-panel screens use `split`: one column on phones,
 * board left and panel right from the lg breakpoint.
 */
export function Screen({ children, split = false }: { children: ReactNode; split?: boolean }) {
  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-5xl px-4 pt-4 pb-8 sm:px-6 sm:pt-6">
      {split ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,560px)_minmax(320px,1fr)] lg:items-start lg:gap-8">
          {children}
        </div>
      ) : (
        children
      )}
    </main>
  );
}

/** Thin top bar: back action on the left, optional status on the right. */
export function TopBar({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex min-h-11 items-center justify-between gap-3 lg:col-span-2">
      <div className="flex items-center gap-3">{left}</div>
      <div className="flex items-center gap-4">{right}</div>
    </header>
  );
}
