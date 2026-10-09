/**
 * Small browser-storage helpers. Storage can be unavailable (private mode,
 * blocked cookies), so every access is guarded and failures are ignored.
 */
import { MATCH, type MatchMode, type Seat } from "@eval-guess/shared";

const TAB_SEAT_KEY = "evalguess:seat";
const DEVICE_SEAT_KEY = "evalguess:lastSeat";
const NAME_KEY = "evalguess:name";

/** A seat remembered on this device, so a match can be resumed after closing the tab. */
export type SavedSeat = { seat: Seat; mode: MatchMode; savedAt: number };

function read<T>(storage: () => Storage, key: string): T | null {
  try {
    const raw = storage().getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: unknown): void {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

const session = () => sessionStorage;
const local = () => localStorage;

/**
 * This tab's seat (sessionStorage): survives a reload and is resumed
 * automatically. Two tabs on one computer can be two different players.
 */
export function loadTabSeat(): Seat | null {
  return read<Seat>(session, TAB_SEAT_KEY);
}

/**
 * Remember a seat for this tab and for the device. The device copy lets a new
 * tab offer to resume after the old one was closed.
 */
export function saveSeat(seat: Seat, mode: MatchMode): void {
  write(session, TAB_SEAT_KEY, seat);
  write(local, DEVICE_SEAT_KEY, { seat, mode, savedAt: Date.now() } satisfies SavedSeat);
}

/** Forget the seat everywhere (left, abandoned, or the match no longer exists). */
export function clearSeat(): void {
  write(session, TAB_SEAT_KEY, null);
  write(local, DEVICE_SEAT_KEY, null);
}

/** Keep the tab copy (so a reload still shows the summary) but stop offering to resume elsewhere. */
export function clearDeviceSeat(): void {
  write(local, DEVICE_SEAT_KEY, null);
}

/**
 * The device's last seat, if the server could still be holding it.
 * Seats are held for MATCH.reconnectGraceMs (online) or soloReconnectGraceMs.
 */
export function loadResumableSeat(): SavedSeat | null {
  const saved = read<SavedSeat>(local, DEVICE_SEAT_KEY);
  if (!saved?.seat) return null;
  const graceMs = saved.mode === "online" ? MATCH.reconnectGraceMs : MATCH.soloReconnectGraceMs;
  // savedAt is refreshed on every update while connected, so this approximates "time since you left".
  return Date.now() - saved.savedAt < graceMs ? saved : null;
}

/** The player's display name is remembered on this device (stored as plain text). */
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
