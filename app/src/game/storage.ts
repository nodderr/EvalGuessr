/**
 * Small browser-storage helpers. Storage can be unavailable (private mode,
 * blocked cookies), so every access is guarded and failures are ignored.
 */
import type { Seat } from "@eval-guess/shared";

const SEAT_KEY = "evalguess:seat";
const NAME_KEY = "evalguess:name";

/**
 * The current match seat lives in sessionStorage: it survives a reload of this
 * tab (so you can rejoin), and two tabs on one computer can be two players.
 */
export function loadSeat(): Seat | null {
  try {
    const raw = sessionStorage.getItem(SEAT_KEY);
    return raw ? (JSON.parse(raw) as Seat) : null;
  } catch {
    return null;
  }
}

export function saveSeat(seat: Seat | null): void {
  try {
    if (seat) sessionStorage.setItem(SEAT_KEY, JSON.stringify(seat));
    else sessionStorage.removeItem(SEAT_KEY);
  } catch {
    /* ignore */
  }
}

/** The player's display name is remembered on this device. */
export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
}
