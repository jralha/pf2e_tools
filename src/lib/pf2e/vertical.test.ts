import { describe, expect, it } from "vitest";
import { computeAirburst, computeDragonBreath } from "./vertical";

describe("computeAirburst", () => {
  it("matches full ground burst at 0 ft and 5 ft origin height", () => {
    const ground = computeAirburst(20, 0);
    expect(ground.groundSquaresHit).toBe(44);
    expect(ground.effectiveGroundRadiusFt).toBe(20);

    // Intersection at 5 ft touches the top of the ground cubes (dz = 1)
    const fiveFt = computeAirburst(20, 5);
    expect(fiveFt.groundSquaresHit).toBe(44);
    expect(fiveFt.effectiveGroundRadiusFt).toBe(20);
  });

  it("shrinks a 20-ft burst to true PF2e ground bursts as detonation height rises", () => {
    // At 10 ft & 15 ft height -> 15-ft ground burst (24 squares)
    const at10 = computeAirburst(20, 10);
    expect(at10.effectiveGroundRadiusFt).toBe(15);
    expect(at10.groundSquaresHit).toBe(24);

    const at15 = computeAirburst(20, 15);
    expect(at15.effectiveGroundRadiusFt).toBe(15);
    expect(at15.groundSquaresHit).toBe(24);

    // At 20 ft height -> 5-ft ground burst (4 squares)
    const at20 = computeAirburst(20, 20);
    expect(at20.groundSquaresHit).toBe(4);
    expect(at20.effectiveGroundRadiusFt).toBe(5);
  });

  it("misses the ground completely when detonated above the burst radius", () => {
    const at25 = computeAirburst(20, 25);
    expect(at25.groundSquaresHit).toBe(0);
    expect(at25.effectiveGroundRadiusFt).toBe(0);
  });
});

describe("computeDragonBreath", () => {
  it("uses the 1-3-3 vertical profile for a 15-ft cone aimed straight down", () => {
    // At 5 ft height -> 1×1 = 1 square
    const at5 = computeDragonBreath(15, 5);
    expect(at5.groundSquaresHit).toBe(1);
    expect(at5.groundWidthFt).toBe(5);

    // At 10 ft height -> 3×3 = 9 squares
    const at10 = computeDragonBreath(15, 10);
    expect(at10.groundSquaresHit).toBe(9);
    expect(at10.groundWidthFt).toBe(15);

    // At 15 ft height -> 3×3 = 9 squares
    const at15 = computeDragonBreath(15, 15);
    expect(at15.groundSquaresHit).toBe(9);
    expect(at15.groundWidthFt).toBe(15);

    // At 20 ft height -> misses ground
    const at20 = computeDragonBreath(15, 20);
    expect(at20.groundSquaresHit).toBe(0);
  });

  it("expands and tapers a 30-ft cone aimed straight down as true PF2e bursts", () => {
    // 5 ft height -> 5-ft burst (4 squares)
    expect(computeDragonBreath(30, 5).groundSquaresHit).toBe(4);
    // 10 ft height -> 10-ft burst (12 squares)
    expect(computeDragonBreath(30, 10).groundSquaresHit).toBe(12);
    // 15 ft height -> 15-ft burst (24 squares)
    expect(computeDragonBreath(30, 15).groundSquaresHit).toBe(24);
    // 20 ft height -> 20-ft burst (44 squares)
    const at20 = computeDragonBreath(30, 20);
    expect(at20.groundSquaresHit).toBe(44);
    expect(at20.effectiveGroundRadiusFt).toBe(20);
    // 25 ft height -> 15-ft burst (24 squares)
    expect(computeDragonBreath(30, 25).groundSquaresHit).toBe(24);
    // 30 ft height -> tapers back to 5-ft burst (4 squares)
    const at30 = computeDragonBreath(30, 30);
    expect(at30.groundSquaresHit).toBe(4);
    expect(at30.effectiveGroundRadiusFt).toBe(5);
    // 35 ft height -> misses ground
    expect(computeDragonBreath(30, 35).groundSquaresHit).toBe(0);
  });
});
