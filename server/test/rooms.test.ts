import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MATCH, TIME_CONTROLS, type MatchView, type PositionRecord } from "@eval-guess/shared";
import { RoomManager, ROOM_LIMITS, errorCode } from "../src/rooms";

const POOL: PositionRecord[] = [120, -340, 15, 700, -60, 230].map((eval_cp, i) => ({
  id: i + 1,
  fen: `8/8/8/8/8/8/8/K6k w - - 0 ${i + 1}`,
  side_to_move: "white",
  eval_cp,
  depth_reached: 20,
  best_move: "Kb2",
}));

type Sent = { to: string; event: string; payload: unknown };

/** Stockfish eval (pawns) of a pool position. Matches pick positions at random. */
const evalOf = (positionId: number) => POOL.find((p) => p.id === positionId)!.eval_cp / 100;

let sent: Sent[];
let rooms: RoomManager;

beforeEach(() => {
  vi.useFakeTimers();
  sent = [];
  rooms = new RoomManager(POOL, (to, event, ...args) => sent.push({ to, event, payload: args[0] }));
});

afterEach(() => {
  rooms.closeAll();
  vi.useRealTimers();
});

/** Latest match view delivered to a connection. */
function lastView(conn: string): MatchView {
  const msgs = sent.filter((s) => s.to === conn && s.event === "match:state");
  return msgs[msgs.length - 1]!.payload as MatchView;
}

function codeOf(fn: () => unknown): string | null | undefined {
  try {
    fn();
  } catch (e) {
    return errorCode(e) ?? "OTHER";
  }
  return undefined;
}

function startOnline(timeControl: "bullet" | "blitz" | "rapid" = "blitz") {
  const a = rooms.create("conn-a", { mode: "online", timeControl, name: "Ana" });
  expect(lastView("conn-a").phase).toBe("lobby");
  const b = rooms.join("conn-b", { matchId: a.matchId, name: "Ben" });
  return { a, b };
}

describe("lobby and joining", () => {
  it("starts the match when the second player joins", () => {
    const { a } = startOnline();
    expect(a.matchId).toMatch(/^[A-Z2-9]{5}$/);
    expect(lastView("conn-a").phase).toBe("guessing");
    expect(lastView("conn-b").players.map((p) => p.name)).toEqual(["Ana", "Ben"]);
  });

  it("rejects a third player and unknown codes", () => {
    const { a } = startOnline();
    expect(codeOf(() => rooms.join("conn-c", { matchId: a.matchId, name: "Cy" }))).toBe("NOT_IN_LOBBY");
    expect(codeOf(() => rooms.join("conn-c", { matchId: "ZZZZZ", name: "Cy" }))).toBe("MATCH_NOT_FOUND");
  });

  it("does not let anyone join a practice match", () => {
    const p = rooms.create("conn-p", { mode: "practice", timeControl: "rapid", name: "Solo" });
    expect(lastView("conn-p").phase).toBe("guessing");
    expect(codeOf(() => rooms.join("conn-x", { matchId: p.matchId, name: "X" }))).toBe("MATCH_NOT_FOUND");
  });

  it("closes a lobby nobody joins", () => {
    rooms.create("conn-a", { mode: "online", timeControl: "blitz", name: "Ana" });
    expect(rooms.size).toBe(1);
    vi.advanceTimersByTime(ROOM_LIMITS.lobbyTtlMs + 1);
    expect(rooms.size).toBe(0);
  });
});

describe("hidden information", () => {
  it("never sends an eval or the opponent's guess before the reveal", () => {
    const { a, b } = startOnline();
    rooms.submitGuess(a, 3.7);
    const before = JSON.stringify(sent.filter((s) => s.to === "conn-b"));
    expect(before).not.toContain("eval_cp");
    expect(before).not.toContain("evalPawns");
    expect(before).not.toContain("3.7");
    expect(lastView("conn-b").players.find((p) => p.id === a.playerId)!.hasGuessed).toBe(true);

    rooms.submitGuess(b, -1);
    const reveal = lastView("conn-b").results[0]!;
    expect(reveal.byPlayer[a.playerId]!.guess).toBe(3.7);
    expect(reveal.evalPawns).toBe(evalOf(reveal.position.id));
  });

  it("never sends seat tokens", () => {
    const { a, b } = startOnline();
    const everything = JSON.stringify(sent);
    expect(everything).not.toContain(a.token);
    expect(everything).not.toContain(b.token);
  });
});

describe("the clock", () => {
  it("reveals as soon as both players guess", () => {
    const { a, b } = startOnline();
    rooms.submitGuess(a, 1);
    expect(lastView("conn-a").phase).toBe("guessing");
    rooms.submitGuess(b, 2);
    expect(lastView("conn-a").phase).toBe("revealed");
  });

  it("closes the round at the deadline and scores a missing guess as 0", () => {
    const { a, b } = startOnline("bullet");
    const exact = evalOf(lastView("conn-a").position!.id);
    rooms.submitGuess(a, exact);
    vi.advanceTimersByTime(TIME_CONTROLS.bullet * 1000);
    expect(lastView("conn-a").phase).toBe("guessing"); // still within the grace period
    vi.advanceTimersByTime(MATCH.deadlineGraceMs + 10);
    const view = lastView("conn-a");
    expect(view.phase).toBe("revealed");
    expect(view.results[0]!.byPlayer[a.playerId]!.points).toBe(100);
    expect(view.results[0]!.byPlayer[b.playerId]!.guess).toBeNull();
  });

  it("auto-advances online matches 10s after a reveal", () => {
    const { a, b } = startOnline();
    rooms.submitGuess(a, 0);
    rooms.submitGuess(b, 0);
    vi.advanceTimersByTime(MATCH.revealAutoAdvanceMs - 10);
    expect(lastView("conn-a").phase).toBe("revealed");
    vi.advanceTimersByTime(20);
    expect(lastView("conn-a").phase).toBe("guessing");
    expect(lastView("conn-a").roundIndex).toBe(1);
  });

  it("advances immediately when both click Next", () => {
    const { a, b } = startOnline();
    rooms.submitGuess(a, 0);
    rooms.submitGuess(b, 0);
    rooms.ready(a);
    expect(lastView("conn-a").phase).toBe("revealed");
    rooms.ready(b);
    expect(lastView("conn-a").roundIndex).toBe(1);
  });

  it("does not auto-advance practice matches", () => {
    const p = rooms.create("conn-p", { mode: "practice", timeControl: "blitz", name: "Solo" });
    rooms.submitGuess(p, 0);
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(lastView("conn-p").phase).toBe("revealed");
  });

  it("plays a whole match to the finish", () => {
    const { a, b } = startOnline();
    for (let r = 0; r < MATCH.positionsPerMatch; r++) {
      rooms.submitGuess(a, 0);
      rooms.submitGuess(b, 5);
      vi.advanceTimersByTime(MATCH.revealAutoAdvanceMs);
    }
    const view = lastView("conn-a");
    expect(view.phase).toBe("finished");
    expect(view.results).toHaveLength(5);
  });
});

describe("connections", () => {
  it("lets a player rejoin with their token, and only with it", () => {
    const { a } = startOnline();
    rooms.disconnected(a, "conn-a");
    expect(lastView("conn-b").players.find((p) => p.id === a.playerId)!.connected).toBe(false);

    expect(codeOf(() => rooms.rejoin("conn-a2", { ...a, token: "guessed" }))).toBe("NOT_IN_MATCH");
    rooms.rejoin("conn-a2", a);
    expect(lastView("conn-a2").you).toBe(a.playerId);
    expect(lastView("conn-b").players.find((p) => p.id === a.playerId)!.connected).toBe(true);

    // The reconnect window was cancelled: nothing happens later.
    vi.advanceTimersByTime(MATCH.reconnectGraceMs * 2);
    expect(rooms.size).toBe(1);
  });

  it("ignores a disconnect from a connection the player already replaced", () => {
    const { a } = startOnline();
    rooms.rejoin("conn-a2", a);
    rooms.disconnected(a, "conn-a"); // the old socket finally closes
    expect(lastView("conn-b").players.find((p) => p.id === a.playerId)!.connected).toBe(true);
  });

  it("calls the match off if a player does not come back", () => {
    const { a } = startOnline();
    rooms.disconnected(a, "conn-a");
    vi.advanceTimersByTime(MATCH.reconnectGraceMs + 1);
    expect(sent).toContainEqual({ to: "conn-b", event: "match:abandoned", payload: { reason: "opponent_timeout" } });
    expect(rooms.size).toBe(0);
  });

  it("tells the opponent when a player leaves", () => {
    const { a } = startOnline();
    rooms.leave(a);
    expect(sent).toContainEqual({ to: "conn-b", event: "match:abandoned", payload: { reason: "opponent_left" } });
    expect(rooms.size).toBe(0);
  });
});

describe("rematch", () => {
  it("starts a new match with the same code once both ask", () => {
    const { a, b } = startOnline();
    for (let r = 0; r < MATCH.positionsPerMatch; r++) {
      rooms.submitGuess(a, 0);
      rooms.submitGuess(b, 0);
      vi.advanceTimersByTime(MATCH.revealAutoAdvanceMs);
    }
    rooms.requestRematch(a);
    expect(lastView("conn-b").players.find((p) => p.id === a.playerId)!.wantsRematch).toBe(true);
    expect(lastView("conn-b").phase).toBe("finished");
    rooms.requestRematch(b);
    const view = lastView("conn-a");
    expect(view.phase).toBe("guessing");
    expect(view.id).toBe(a.matchId);
    expect(view.results).toHaveLength(0);

    // The finished-match expiry must not kill the rematch.
    vi.advanceTimersByTime(ROOM_LIMITS.finishedTtlMs + 1);
    expect(rooms.size).toBe(1);
  });
});
