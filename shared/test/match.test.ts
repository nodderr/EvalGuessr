import { describe, expect, it } from "vitest";
import {
  MATCH,
  MatchError,
  addPlayer,
  createMatch,
  markReady,
  pickPositions,
  revealRound,
  shouldReveal,
  startMatch,
  submitGuess,
  totals,
  viewFor,
  type MatchState,
  type PositionRecord,
} from "../src";

const POOL: PositionRecord[] = [100, -250, 0, 640, -30, 75].map((eval_cp, i) => ({
  id: i + 1,
  fen: `fen-${i + 1}`,
  side_to_move: i % 2 ? "black" : "white",
  eval_cp,
  depth_reached: 20,
  best_move: "e4",
}));

const T0 = 1_000_000;

function onlineMatch(): MatchState {
  let m = createMatch({ id: "ABCD", mode: "online", timeControl: "blitz", positions: POOL.slice(0, 5) });
  m = addPlayer(m, { id: "alice", name: "Alice" });
  m = addPlayer(m, { id: "bob", name: "Bob" });
  return startMatch(m, T0);
}

function errorCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof MatchError ? e.code : "OTHER";
  }
  return undefined;
}

describe("pickPositions", () => {
  it("returns distinct positions", () => {
    const picked = pickPositions(POOL, 5);
    expect(picked).toHaveLength(5);
    expect(new Set(picked.map((p) => p.id)).size).toBe(5);
  });

  it("caps at the pool size", () => {
    expect(pickPositions(POOL.slice(0, 3), 5)).toHaveLength(3);
  });
});

describe("match lifecycle", () => {
  it("practice matches have one seat", () => {
    let m = createMatch({ id: "P", mode: "practice", timeControl: "rapid", positions: POOL.slice(0, 5) });
    m = addPlayer(m, { id: "solo", name: "Solo" });
    expect(errorCode(() => addPlayer(m, { id: "x", name: "X" }))).toBe("MATCH_FULL");
    expect(startMatch(m, T0).phase).toBe("guessing");
  });

  it("online matches need two players to start", () => {
    let m = createMatch({ id: "O", mode: "online", timeControl: "bullet", positions: POOL });
    m = addPlayer(m, { id: "alice", name: "Alice" });
    expect(errorCode(() => startMatch(m, T0))).toBe("NOT_ENOUGH_PLAYERS");
  });

  it("sets the deadline from the time control", () => {
    expect(onlineMatch().roundDeadline).toBe(T0 + 30_000); // blitz = 30s
  });

  it("reveals once both players have guessed, and scores both", () => {
    let m = onlineMatch();
    m = submitGuess(m, "alice", 1.2, T0 + 5000); // eval +1.00 -> gap 0.2 -> 100
    expect(shouldReveal(m, T0 + 5000)).toBe(false);
    m = submitGuess(m, "bob", 3.5, T0 + 6000); // gap 2.5 -> 50
    expect(shouldReveal(m, T0 + 6000)).toBe(true);

    m = revealRound(m);
    expect(m.phase).toBe("revealed");
    expect(m.results[0]!.evalPawns).toBe(1);
    expect(m.results[0]!.byPlayer.alice!.points).toBe(100);
    expect(m.results[0]!.byPlayer.bob!.points).toBe(50);
    expect(totals(m)).toEqual({ alice: 100, bob: 50 });
  });

  it("guesses are final", () => {
    const m = submitGuess(onlineMatch(), "alice", 0, T0);
    expect(errorCode(() => submitGuess(m, "alice", 2, T0 + 1))).toBe("ALREADY_GUESSED");
  });

  it("times out a round and gives 0 to a player who never guessed", () => {
    let m = submitGuess(onlineMatch(), "alice", 1, T0 + 1000);
    const afterDeadline = T0 + 30_000 + MATCH.deadlineGraceMs + 1;
    expect(shouldReveal(m, T0 + 30_000)).toBe(false); // still inside grace
    expect(shouldReveal(m, afterDeadline)).toBe(true);
    expect(errorCode(() => submitGuess(m, "bob", 1, afterDeadline))).toBe("TOO_LATE");

    m = revealRound(m);
    expect(m.results[0]!.byPlayer.bob).toEqual({ guess: null, gap: null, points: 0, perfect: false });
  });

  it("advances when every connected player is ready, and finishes after the last round", () => {
    let m = onlineMatch();
    for (let round = 0; round < 5; round++) {
      expect(m.phase).toBe("guessing");
      expect(m.roundIndex).toBe(round);
      m = submitGuess(m, "alice", 0, T0);
      m = submitGuess(m, "bob", 0, T0);
      m = revealRound(m);
      m = markReady(m, "alice", T0);
      if (round < 4) expect(m.phase).toBe("revealed"); // waiting for bob
      m = markReady(m, "bob", T0);
    }
    expect(m.phase).toBe("finished");
    expect(m.results).toHaveLength(5);
  });
});

describe("viewFor (what a client is allowed to see)", () => {
  it("never leaks the eval or the opponent's guess before the reveal", () => {
    const m = submitGuess(onlineMatch(), "alice", 2.3, T0);
    const bobsView = viewFor(m, "bob", T0);
    const json = JSON.stringify(bobsView);

    expect(json).not.toContain("eval_cp");
    expect(json).not.toContain("2.3");
    expect(bobsView.results).toHaveLength(0);
    expect(bobsView.players.find((p) => p.id === "alice")!.hasGuessed).toBe(true);
    expect(bobsView.yourGuess).toBeNull();
    expect(viewFor(m, "alice", T0).yourGuess).toBe(2.3);
  });

  it("shows both guesses and the eval after the reveal", () => {
    let m = submitGuess(onlineMatch(), "alice", 2.3, T0);
    m = revealRound(submitGuess(m, "bob", -1, T0));
    const reveal = viewFor(m, "bob", T0).results[0]!;
    expect(reveal.evalPawns).toBe(1);
    expect(reveal.byPlayer.alice!.guess).toBe(2.3);
    expect(reveal.byPlayer.bob!.guess).toBe(-1);
  });
});
