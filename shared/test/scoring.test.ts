import { describe, expect, it } from "vitest";
import { formatEval, normalizeGuess, scoreGuess } from "../src";

describe("scoreGuess", () => {
  it.each([
    // [guess, eval, expected points]
    [0.5, 0.5, 100], // exact
    [1.5, 0.5, 100], // gap 1.0, edge of perfect window
    [-1.0, 0.0, 100],
    [2.5, 0.0, 50], // gap 2.5 -> halfway between 1.0 and 4.0
    [3.0, 0.0, 33], // 33.33 rounds down
    [2.0, 0.0, 67], // 66.67 rounds up
    [4.0, 0.0, 0], // gap 4.0 -> zero point
    [10, -10, 0], // far beyond
  ])("guess %d vs eval %d -> %d points", (guess, evalPawns, points) => {
    expect(scoreGuess(guess, evalPawns).points).toBe(points);
  });

  it("is symmetric in the sign of the gap", () => {
    expect(scoreGuess(-2.2, 0.3)).toEqual(scoreGuess(2.8, 0.3));
  });

  it("flags perfect guesses", () => {
    expect(scoreGuess(1.0, 0.0).perfect).toBe(true);
    expect(scoreGuess(1.1, 0.0).perfect).toBe(false);
  });

  it("accepts a custom config", () => {
    const strict = { perfectWindow: 0.5, zeroAt: 2.0, maxPoints: 100 };
    expect(scoreGuess(1.25, 0, strict).points).toBe(50);
  });
});

describe("eval helpers", () => {
  it("formats like an eval bar", () => {
    expect(formatEval(1.4)).toBe("+1.4");
    expect(formatEval(-0.33)).toBe("-0.3");
    expect(formatEval(0)).toBe("0.0");
    expect(formatEval(-0.04)).toBe("0.0");
  });

  it("clamps and rounds guesses", () => {
    expect(normalizeGuess(12)).toBe(10);
    expect(normalizeGuess(-15)).toBe(-10);
    expect(normalizeGuess(1.26)).toBe(1.3);
    expect(Object.is(normalizeGuess(-0.01), 0)).toBe(true);
  });
});
