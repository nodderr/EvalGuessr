import { useEffect, useRef, type RefObject } from "react";
import { EVAL_RANGE, normalizeGuess } from "@eval-guess/shared";

const FINE_STEP = 0.1;
const COARSE_STEP = 1;

/**
 * New guess for a key press, or null if the key doesn't adjust the guess.
 * Up/Down and W/S follow the handle on screen (the bar flips with the board);
 * Right/Left always mean +/-. Shift takes bigger steps.
 */
export function nudge(key: string, shift: boolean, value: number, orientation: "white" | "black"): number | null {
  const step = shift ? COARSE_STEP : FINE_STEP;
  const up = orientation === "white" ? 1 : -1;
  const next: Record<string, number> = {
    ArrowUp: value + up * step,
    ArrowDown: value - up * step,
    w: value + up * step,
    s: value - up * step,
    ArrowRight: value + step,
    ArrowLeft: value - step,
    PageUp: value + up * COARSE_STEP,
    PageDown: value - up * COARSE_STEP,
    Home: EVAL_RANGE.min,
    End: EVAL_RANGE.max,
  };
  // Letters arrive as "W" with Shift held.
  const k = key.length === 1 ? key.toLowerCase() : key;
  return k in next ? normalizeGuess(next[k]!) : null;
}

/** Wheel distance (px) per 0.1 step: one mouse-wheel notch (~100px). Trackpad deltas add up smoothly. */
const WHEEL_PX_PER_STEP = 100;

/**
 * Scrolling moves the guess: scroll up moves the handle up. Listens on `ref`,
 * or on the whole window when `ref` is null (the match screen, where the page
 * itself doesn't need to scroll while guessing). Non-passive, so the page
 * doesn't scroll at the same time.
 */
export function useWheelNudge(
  ref: RefObject<HTMLElement | null> | null,
  opts: { enabled: boolean; value: number; orientation: "white" | "black"; onChange?: (pawns: number) => void },
) {
  const latest = useRef(opts);
  latest.current = opts;

  useEffect(() => {
    const el: HTMLElement | Window | null = ref ? ref.current : window;
    if (!el) return;
    let carry = 0;
    const onWheel = (event: Event) => {
      const e = event as WheelEvent;
      const { enabled, value, orientation, onChange } = latest.current;
      if (!enabled || !onChange) return;
      e.preventDefault();
      // Some browsers turn Shift+wheel into horizontal scrolling.
      const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      carry += e.deltaMode === WheelEvent.DOM_DELTA_LINE ? delta * 33 : delta;
      const steps = Math.trunc(carry / WHEEL_PX_PER_STEP);
      if (steps === 0) return;
      carry -= steps * WHEEL_PX_PER_STEP;
      // Scrolling up (negative delta) moves the handle up.
      const up = orientation === "white" ? 1 : -1;
      const step = e.shiftKey ? COARSE_STEP : FINE_STEP;
      onChange(normalizeGuess(value - steps * up * step));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref]);
}

/**
 * Arrow keys adjust the guess and Enter locks it in, without having to click
 * the bar first. Ignored while typing in a field; the bar handles its own keys
 * when focused (it calls preventDefault, so they aren't applied twice).
 */
export function useGuessKeys(opts: {
  enabled: boolean;
  value: number;
  orientation: "white" | "black";
  onChange: (pawns: number) => void;
  onSubmit?: () => void;
}) {
  const latest = useRef(opts);
  latest.current = opts;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const { enabled, value, orientation, onChange, onSubmit } = latest.current;
      if (!enabled || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;

      if (e.key === "Enter") {
        // A focused button already handles Enter itself.
        if (target?.closest("button") || !onSubmit) return;
        e.preventDefault();
        onSubmit();
        return;
      }
      const next = nudge(e.key, e.shiftKey, value, orientation);
      if (next !== null) {
        e.preventDefault(); // stop the page from scrolling
        onChange(next);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
