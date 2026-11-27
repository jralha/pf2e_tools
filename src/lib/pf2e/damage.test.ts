import { describe, expect, it } from "vitest";
import {
  buildExpressionPMF,
  computeAdvancedDamage,
  computeDegreesOfSuccess,
  degreesFromRawProbability,
  parseDiceExpression,
  summarizePMF,
} from "./damage";

describe("parseDiceExpression & basic PMF", () => {
  it("parses and computes exact distribution for 2d6 + 2", () => {
    const parsed = parseDiceExpression("2d6 + 2");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const summary = summarizePMF(buildExpressionPMF(parsed.terms));
    expect(summary.mean).toBeCloseTo(9, 6);
    expect(summary.min).toBe(4);
    expect(summary.max).toBe(14);
    expect(summary.median).toBe(9);
    // P(2d6+2 = 9) = 6/36 = 1/6
    const bin9 = summary.bins.find((b) => b.value === 9);
    expect(bin9?.probability).toBeCloseTo(1 / 6, 6);
  });

  it("supports multiple dice terms and subtraction", () => {
    const parsed = parseDiceExpression("1d8 + 1d4 - 2");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const summary = summarizePMF(buildExpressionPMF(parsed.terms));
    // 4.5 + 2.5 - 2 = 5.0
    expect(summary.mean).toBeCloseTo(5, 6);
    expect(summary.min).toBe(0);
    expect(summary.max).toBe(10);
  });

  it("rejects invalid expressions", () => {
    expect(parseDiceExpression("").ok).toBe(false);
    expect(parseDiceExpression("2d6 + foo").ok).toBe(false);
    expect(parseDiceExpression("2d1").ok).toBe(false);
  });
});

describe("PF2e Degrees of Success", () => {
  it("computes exact d20 degrees with ±10 and nat 20 / nat 1", () => {
    // +10 vs DC 18 -> needs 8+ (crit on 18, 19, 20 = 15%; hit on 8..17 = 50%; fail on 2..7 = 30%; crit fail on 1 = 5%)
    const d = computeDegreesOfSuccess(10, 18);
    expect(d.critSuccess).toBeCloseTo(0.15, 6);
    expect(d.success).toBeCloseTo(0.5, 6);
    expect(d.failure).toBeCloseTo(0.3, 6);
    expect(d.critFailure).toBeCloseTo(0.05, 6);
  });

  it("derives matching degrees from raw probability", () => {
    // 65% hit -> 15% crit, 50% hit, 35% miss
    const d65 = degreesFromRawProbability(0.65);
    expect(d65.critSuccess).toBeCloseTo(0.15, 6);
    expect(d65.success).toBeCloseTo(0.5, 6);

    // 40% save success -> 5% crit success (nat 20), 35% success, 50% fail, 10% crit fail
    const d40 = degreesFromRawProbability(0.4);
    expect(d40.critSuccess).toBeCloseTo(0.05, 6);
    expect(d40.success).toBeCloseTo(0.35, 6);
    expect(d40.failure).toBeCloseTo(0.5, 6);
    expect(d40.critFailure).toBeCloseTo(0.1, 6);
  });
});

describe("computeAdvancedDamage", () => {
  it("computes Attack Roll expected damage with Deadly, Fatal, and Weakness/Resistance", () => {
    // +10 vs AC 20 -> 5% crit, 50% hit, 45% miss
    // Base 1d8 + 4 (avg 8.5), Fatal d12 -> crit is 2*(1d12+4) + 1d12 = 3*6.5 + 8 = 27.5
    const res = computeAdvancedDamage({
      resolution: "attack",
      probMode: "roll",
      rollModifier: 10,
      targetDC: 20,
      extraRollMod: 0,
      rawProbPercent: 55,
      baseExpression: "1d8 + 4",
      critExtraExpression: "",
      fatalDie: 12,
      weakness: 0,
      resistance: 0,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.onHitMean).toBeCloseTo(8.5, 6);
    expect(res.onCritMean).toBeCloseTo(27.5, 6);
    expect(res.overall.mean).toBeCloseTo(0.5 * 8.5 + 0.05 * 27.5, 6);
  });

  it("computes Basic Save expected damage with weakness and resistance", () => {
    // Target save +10 vs DC 20 -> 5% crit succ (0), 50% succ (half), 40% fail (full), 5% crit fail (double)
    // Flat 10 damage, resistance 5 -> half is 5-5=0, full is 10-5=5, double is 20-5=15
    const res = computeAdvancedDamage({
      resolution: "save",
      probMode: "roll",
      rollModifier: 10,
      targetDC: 20,
      extraRollMod: 0,
      rawProbPercent: 55,
      baseExpression: "10",
      critExtraExpression: "",
      fatalDie: 0,
      weakness: 0,
      resistance: 5,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.onHalfMean).toBeCloseTo(0, 6);
    expect(res.onHitMean).toBeCloseTo(5, 6);
    expect(res.onCritMean).toBeCloseTo(15, 6);
    expect(res.overall.mean).toBeCloseTo(0.4 * 5 + 0.05 * 15, 6);
  });
});
