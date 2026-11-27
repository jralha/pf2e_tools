import { describe, expect, it } from "vitest";
import {
  canPlaceEnemy,
  computeAoEGrid,
  computeEmanationGrid,
  diagCost,
  enemyDistanceToOrigin,
  isEnemyHitByAoE,
  pf2e3DDistance,
  pf2eDistance,
  pf2eIntersectionDistance,
  type AoEConfig,
  type EnemyToken,
} from "./grid";

describe("diagCost", () => {
  it("computes PF2e alternating 5/10/5/10 diagonal costs", () => {
    expect(diagCost(0)).toBe(0);
    expect(diagCost(1)).toBe(5);
    expect(diagCost(2)).toBe(15);
    expect(diagCost(3)).toBe(20);
    expect(diagCost(4)).toBe(30);
    expect(diagCost(5)).toBe(35);
    expect(diagCost(6)).toBe(45);
  });
});

describe("pf2eDistance", () => {
  it("returns 0 for squares occupied by the token", () => {
    expect(pf2eDistance(0, 0, 1)).toBe(0);
    expect(pf2eDistance(1, 1, 2)).toBe(0);
    expect(pf2eDistance(3, 2, 4)).toBe(0);
  });

  it("measures orthogonal, diagonal, and mixed distances from a Medium token", () => {
    expect(pf2eDistance(1, 0, 1)).toBe(5);
    expect(pf2eDistance(1, 1, 1)).toBe(5);
    expect(pf2eDistance(2, 1, 1)).toBe(10);
    expect(pf2eDistance(2, 2, 1)).toBe(15);
    expect(pf2eDistance(-3, 2, 1)).toBe(20);
  });

  it("measures from the nearest edge of a Large (2×2) token", () => {
    expect(pf2eDistance(2, 0, 2)).toBe(5);
    expect(pf2eDistance(2, 2, 2)).toBe(5);
    expect(pf2eDistance(-1, -1, 2)).toBe(5);
    expect(pf2eDistance(3, 3, 2)).toBe(15);
  });
});

describe("pf2eIntersectionDistance", () => {
  it("measures symmetrically from a grid intersection to all 4 surrounding squares", () => {
    expect(pf2eIntersectionDistance(0, 0, 0, 0)).toBe(5);
    expect(pf2eIntersectionDistance(-1, 0, 0, 0)).toBe(5);
    expect(pf2eIntersectionDistance(0, -1, 0, 0)).toBe(5);
    expect(pf2eIntersectionDistance(-1, -1, 0, 0)).toBe(5);
    expect(pf2eIntersectionDistance(1, 1, 0, 0)).toBe(15);
  });
});

describe("computeEmanationGrid", () => {
  it("matches standard PF2e emanation square counts", () => {
    const med5 = computeEmanationGrid(1, 5);
    expect(med5.tokenCount).toBe(1);
    expect(med5.affectedCount).toBe(8);

    const med10 = computeEmanationGrid(1, 10);
    expect(med10.tokenCount).toBe(1);
    expect(med10.affectedCount).toBe(20);

    const large5 = computeEmanationGrid(2, 5);
    expect(large5.tokenCount).toBe(4);
    expect(large5.affectedCount).toBe(12);

    const huge10 = computeEmanationGrid(3, 10);
    expect(huge10.tokenCount).toBe(9);
    expect(huge10.affectedCount).toBe(36);
  });
});

describe("computeAoEGrid — Bursts", () => {
  it("matches official PF2e burst templates (5, 10, 15, 20 ft)", () => {
    const burst = (sizeFt: number) =>
      computeAoEGrid({ type: "burst", tokenSize: 1, sizeFt, direction: "E" });

    expect(burst(5).affectedCount).toBe(4);
    expect(burst(10).affectedCount).toBe(12);
    expect(burst(15).affectedCount).toBe(24);
    expect(burst(20).affectedCount).toBe(44); // Fireball
    expect(burst(20).hasCaster).toBe(false);
    expect(burst(20).originIntersection).toEqual({ x: 0, y: 0 });
  });
});

describe("computeAoEGrid — Cones", () => {
  it("matches official PF2e orthogonal and diagonal cone templates", () => {
    const cone = (sizeFt: number, direction: AoEConfig["direction"]) =>
      computeAoEGrid({ type: "cone", tokenSize: 1, sizeFt, direction });

    // 15-ft orthogonal cone: PF2e 1-3-3 pattern = 7 squares
    expect(cone(15, "E").affectedCount).toBe(7);
    expect(cone(15, "N").affectedCount).toBe(7);
    expect(cone(15, "W").affectedCount).toBe(7);
    expect(cone(15, "S").affectedCount).toBe(7);

    // Verify exact 1-3-3 coordinates for 15-ft East cone from Medium caster at (0,0)
    const east15 = cone(15, "E")
      .cells.filter((c) => c.kind === "affected")
      .map((c) => `${c.i},${c.j}`)
      .sort();
    expect(east15).toEqual(["1,0", "2,-1", "2,0", "2,1", "3,-1", "3,0", "3,1"]);

    // 15-ft diagonal cone: 3 + 2 + 1 = 6 squares (1 quadrant of 15-ft burst)
    expect(cone(15, "NE").affectedCount).toBe(6);
    expect(cone(15, "SW").affectedCount).toBe(6);

    // 30-ft orthogonal cone: 2 + 4 + 6 + 8 + 6 + 2 = 28 squares
    expect(cone(30, "E").affectedCount).toBe(28);

    // 30-ft diagonal cone: 6 + 5 + 5 + 4 + 3 + 1 = 24 squares
    expect(cone(30, "NE").affectedCount).toBe(24);
  });
});

describe("enemy token helpers", () => {
  it("computes minimum distance and hit detection across AoE types", () => {
    const emanation10: AoEConfig = {
      type: "emanation",
      tokenSize: 1,
      sizeFt: 10,
      direction: "E",
    };
    expect(enemyDistanceToOrigin({ i: 2, j: 1, size: 2 }, emanation10)).toBe(10);
    expect(isEnemyHitByAoE({ i: 2, j: 1, size: 2 }, emanation10)).toBe(true);
    expect(isEnemyHitByAoE({ i: 2, j: 2, size: 2 }, emanation10)).toBe(false);

    const burst10: AoEConfig = {
      type: "burst",
      tokenSize: 1,
      sizeFt: 10,
      direction: "E",
    };
    expect(isEnemyHitByAoE({ i: 0, j: 0, size: 1 }, burst10)).toBe(true);
    expect(isEnemyHitByAoE({ i: 1, j: 1, size: 1 }, burst10)).toBe(false); // 15 ft corner
  });

  it("validates enemy placement bounds and overlap rules", () => {
    const existing: EnemyToken[] = [
      {
        id: 1,
        label: "E1",
        sizeName: "Medium",
        size: 1,
        i: 2,
        j: 0,
        elevationFt: 0,
      },
    ];
    expect(canPlaceEnemy(1, 1, 1, true, 1, existing, -4, 5, -4, 5)).toBe(true);
    expect(canPlaceEnemy(0, 0, 1, true, 1, existing, -4, 5, -4, 5)).toBe(false);
    // In burst mode (hasCaster=false), (0,0) is open for enemies!
    expect(canPlaceEnemy(0, 0, 1, false, 1, existing, -4, 5, -4, 5)).toBe(true);
    expect(canPlaceEnemy(2, 0, 1, true, 1, existing, -4, 5, -4, 5)).toBe(false);
    expect(canPlaceEnemy(4, 0, 2, true, 1, existing, -4, 5, -4, 5)).toBe(false);
  });

  it("accounts for enemy elevation in hit detection across emanation, burst, and cone", () => {
    const emanation10: AoEConfig = {
      type: "emanation",
      tokenSize: 1,
      sizeFt: 10,
      direction: "E",
    };
    // At (2, 0), max elevation for 10 ft emanation is 5 ft
    expect(
      isEnemyHitByAoE({ i: 2, j: 0, size: 1, elevationFt: 5 }, emanation10),
    ).toBe(true);
    expect(
      isEnemyHitByAoE({ i: 2, j: 0, size: 1, elevationFt: 10 }, emanation10),
    ).toBe(false);

    const fireball: AoEConfig = {
      type: "burst",
      tokenSize: 1,
      sizeFt: 20,
      direction: "E",
    };
    // At (0, 0), max elevation is 15 ft
    expect(
      isEnemyHitByAoE({ i: 0, j: 0, size: 1, elevationFt: 15 }, fireball),
    ).toBe(true);
    expect(
      isEnemyHitByAoE({ i: 0, j: 0, size: 1, elevationFt: 20 }, fireball),
    ).toBe(false);

    const cone15E: AoEConfig = {
      type: "cone",
      tokenSize: 1,
      sizeFt: 15,
      direction: "E",
    };
    // At (2, 0), max elevation is 5 ft
    expect(
      isEnemyHitByAoE({ i: 2, j: 0, size: 1, elevationFt: 5 }, cone15E),
    ).toBe(true);
    expect(
      isEnemyHitByAoE({ i: 2, j: 0, size: 1, elevationFt: 10 }, cone15E),
    ).toBe(false);
  });
});

describe("3D distance and max elevation", () => {
  it("computes PF2e 3D alternating-diagonal distances", () => {
    expect(pf2e3DDistance(1, 1, 1)).toBe(5);
    expect(pf2e3DDistance(2, 1, 1)).toBe(10);
    expect(pf2e3DDistance(2, 2, 1)).toBe(15);
    expect(pf2e3DDistance(2, 2, 2)).toBe(15);
    expect(pf2e3DDistance(3, 2, 1)).toBe(20);
  });

  it("computes max elevation per square for emanations", () => {
    const grid = computeEmanationGrid(1, 10);
    const at = (i: number, j: number) =>
      grid.cells.find((c) => c.i === i && c.j === j)?.maxElevationFt;

    // Directly above Medium caster: 10 ft emanation reaches 10 ft elevation
    expect(at(0, 0)).toBe(10);
    // 5 ft away: up to 10 ft elevation
    expect(at(1, 0)).toBe(10);
    expect(at(1, 1)).toBe(10);
    // 10 ft away: up to 5 ft elevation
    expect(at(2, 0)).toBe(5);
    expect(at(2, 1)).toBe(5);
    // Outside emanation
    expect(at(2, 2)).toBeNull();
  });

  it("computes max elevation per square for bursts", () => {
    const fireball = computeAoEGrid({
      type: "burst",
      tokenSize: 1,
      sizeFt: 20,
      direction: "E",
    });
    const at = (i: number, j: number) =>
      fireball.cells.find((c) => c.i === i && c.j === j)?.maxElevationFt;

    // Adjacent to ground intersection (0,0): reaches 15 ft elevation (cube 15-20 ft)
    expect(at(0, 0)).toBe(15);
    // 10 ft out: reaches 10 ft elevation
    expect(at(1, 0)).toBe(10);
    // Outer rim (20 ft out): ground level only (0 ft)
    expect(at(3, 0)).toBe(0);
  });

  it("computes max elevation per square for 15-ft orthogonal cones", () => {
    const cone15 = computeAoEGrid({
      type: "cone",
      tokenSize: 1,
      sizeFt: 15,
      direction: "E",
    });
    const at = (i: number, j: number) =>
      cone15.cells.find((c) => c.i === i && c.j === j)?.maxElevationFt;

    expect(at(1, 0)).toBe(0);
    expect(at(2, 0)).toBe(5);
    expect(at(2, 1)).toBe(5);
    expect(at(3, 1)).toBe(5);
  });
});
