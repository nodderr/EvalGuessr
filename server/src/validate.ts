/**
 * Everything from a client is untrusted. These checks turn raw socket payloads
 * into typed values or throw InvalidRequest.
 */
import { TIME_CONTROLS, type MatchMode, type Seat, type TimeControl } from "@eval-guess/shared";
import { CODE_LENGTH } from "./ids";

export class InvalidRequest extends Error {}

const MAX_NAME = 20;

function obj(v: unknown): Record<string, unknown> {
  if (typeof v !== "object" || v === null) throw new InvalidRequest("Expected an object");
  return v as Record<string, unknown>;
}

function str(v: unknown, what: string): string {
  if (typeof v !== "string") throw new InvalidRequest(`${what} must be a string`);
  return v;
}

export function name(v: unknown): string {
  // Collapse whitespace and drop control characters; names are shown to the opponent.
  const cleaned = str(v, "name").replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/\s+/g, " ").trim();
  if (!cleaned) throw new InvalidRequest("Name is empty");
  return cleaned.slice(0, MAX_NAME);
}

export function matchCode(v: unknown): string {
  const code = str(v, "matchId").trim().toUpperCase();
  if (code.length !== CODE_LENGTH || !/^[A-Z0-9]+$/.test(code)) throw new InvalidRequest("Bad match code");
  return code;
}

export function createRequest(v: unknown): { mode: MatchMode; timeControl: TimeControl | null; name: string } {
  const o = obj(v);
  if (o.mode !== "practice" && o.mode !== "endless" && o.mode !== "online") throw new InvalidRequest("Bad mode");
  // Endless has no clock; every other mode needs a valid time control.
  if (o.mode === "endless") return { mode: o.mode, timeControl: null, name: name(o.name) };
  if (typeof o.timeControl !== "string" || !(o.timeControl in TIME_CONTROLS)) {
    throw new InvalidRequest("Bad time control");
  }
  return { mode: o.mode, timeControl: o.timeControl as TimeControl, name: name(o.name) };
}

export function joinRequest(v: unknown): { matchId: string; name: string } {
  const o = obj(v);
  return { matchId: matchCode(o.matchId), name: name(o.name) };
}

export function seat(v: unknown): Seat {
  const o = obj(v);
  return { matchId: matchCode(o.matchId), playerId: str(o.playerId, "playerId"), token: str(o.token, "token") };
}

export function guess(v: unknown): number {
  const g = obj(v).guess;
  if (typeof g !== "number" || !Number.isFinite(g)) throw new InvalidRequest("Guess must be a number");
  return g; // clamped and rounded by the state machine
}
