import { describe, expect, it } from "vitest";
import { barFractionToEval, evalToBarFraction } from "../src";

describe("eval bar scale", () => {
  it("maps 0 to the middle and the range ends to the bar ends", () => {
    expect(evalToBarFraction(0)).toBeCloseTo(0.5);
    expect(evalToBarFraction(10)).toBeCloseTo(1);
    expect(evalToBarFraction(-10)).toBeCloseTo(0);
  });

  it("clamps out-of-range input", () => {
    expect(evalToBarFraction(25)).toBeCloseTo(1);
    expect(barFractionToEval(1.4)).toBeCloseTo(10);
    expect(barFractionToEval(-0.3)).toBeCloseTo(-10);
  });

  it("round-trips", () => {
    for (const p of [-9.7, -3.2, -0.4, 0, 0.1, 1.4, 6.6, 10]) {
      expect(barFractionToEval(evalToBarFraction(p))).toBeCloseTo(p, 6);
    }
  });

  it("gives more room near 0 than near the ends", () => {
    const nearZero = evalToBarFraction(1) - evalToBarFraction(0);
    const nearEnd = evalToBarFraction(10) - evalToBarFraction(9);
    expect(nearZero).toBeGreaterThan(5 * nearEnd);
  });

  it("is symmetric: White's share at +x equals Black's share at -x", () => {
    expect(evalToBarFraction(2.5)).toBeCloseTo(1 - evalToBarFraction(-2.5));
  });
});
