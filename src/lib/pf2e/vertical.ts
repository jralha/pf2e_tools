import { pf2e3DDistance, pf2eIntersectionDistance } from "./grid";

export type SideCellKind = "empty" | "air" | "ground-hit";

export interface SideViewCell {
  /** Horizontal column index. */
  x: number;
  /** Vertical elevation cube index (0 = ground level 0–5 ft, 1 = 5–10 ft, ...). */
  z: number;
  kind: SideCellKind;
}

export interface GroundCell {
  i: number;
  j: number;
  hit: boolean;
}

export interface VerticalAoEResult {
  /** Side-view cross-section cells (ordered top-down: highest z first, then increasing x). */
  sideCells: SideViewCell[];
  sideLoX: number;
  sideHiX: number;
  sideMaxZ: number;
  /** Origin marker coordinates in side-view space (x, z in 5-ft grid units; z=0 is ground line). */
  sideOrigin: { x: number; z: number };
  /** Top-down ground-level cells (ordered north-up: highest j first, then increasing i). */
  groundCells: GroundCell[];
  groundLo: number;
  groundHi: number;
  /** Origin marker in top-down ground space. */
  groundOrigin: { x: number; y: number };
  /** Number of ground-level 5-ft squares hit. */
  groundSquaresHit: number;
  /** Effective radius on the ground in feet (0 if ground is not reached). */
  effectiveGroundRadiusFt: number;
  /** Maximum horizontal width on the ground in feet. */
  groundWidthFt: number;
}

/**
 * Computes a PF2e Airburst: a Burst of `radiusFt` detonated at `originHeightFt` above the ground.
 * Origin is a grid intersection at (0, 0, h) where h = originHeightFt / 5.
 */
export function computeAirburst(
  radiusFt: number,
  originHeightFt: number,
): VerticalAoEResult {
  const radiusSq = Math.floor(radiusFt / 5);
  const h = Math.max(0, Math.floor(originHeightFt / 5));

  // Side-view bounds
  const sideHalfX = radiusSq + 2;
  const sideLoX = -sideHalfX;
  const sideHiX = sideHalfX;
  const sideMaxZ = Math.max(h + radiusSq + 1, radiusSq + 2);

  const sideCells: SideViewCell[] = [];
  for (let z = sideMaxZ - 1; z >= 0; z--) {
    // Vertical distance in 5-ft cubes from intersection at z = h to cube [z, z + 1]
    const dz = z >= h ? z - h + 1 : h - z;
    for (let x = sideLoX; x < sideHiX; x++) {
      const dx = x >= 0 ? x + 1 : -x;
      // Cross-section through center slice (dy = 1)
      const inBurst = pf2e3DDistance(dx, 1, dz) <= radiusFt;
      const kind: SideCellKind = !inBurst
        ? "empty"
        : z === 0
          ? "ground-hit"
          : "air";
      sideCells.push({ x, z, kind });
    }
  }

  // Ground-level footprint: a PF2e Burst matching the side-view ground reach
  const groundDz = Math.max(1, h);
  let maxGroundReachSq = 0;
  for (let dx = 1; dx <= radiusSq; dx++) {
    if (pf2e3DDistance(dx, 1, groundDz) <= radiusFt) {
      maxGroundReachSq = dx;
    }
  }
  const effectiveGroundRadiusFt = maxGroundReachSq * 5;

  const groundHalf = radiusSq + 2;
  const groundLo = -groundHalf;
  const groundHi = groundHalf;

  const groundCells: GroundCell[] = [];
  let groundSquaresHit = 0;

  for (let j = groundHi - 1; j >= groundLo; j--) {
    for (let i = groundLo; i < groundHi; i++) {
      const hit =
        effectiveGroundRadiusFt > 0 &&
        pf2eIntersectionDistance(i, j, 0, 0) <= effectiveGroundRadiusFt;
      if (hit) {
        groundSquaresHit++;
      }
      groundCells.push({ i, j, hit });
    }
  }

  return {
    sideCells,
    sideLoX,
    sideHiX,
    sideMaxZ,
    sideOrigin: { x: 0, z: h },
    groundCells,
    groundLo,
    groundHi,
    groundOrigin: { x: 0, y: 0 },
    groundSquaresHit,
    effectiveGroundRadiusFt,
    groundWidthFt: maxGroundReachSq * 10,
  };
}

/**
 * Computes a PF2e Dragon Breath (Cone aimed straight down) of `coneLengthFt`
 * from a flying dragon at `originHeightFt` above the ground.
 *
 * - 15-ft cone: uses PF2e's 1–3–3 orthogonal cone profile turned straight down
 *   (1×1 at 5 ft down, 3×3 at 10 ft and 15 ft down).
 * - 30-ft+ cone: uses PF2e's intersection-origin 90° cone profile turned straight down
 *   (dz downward from z = h, dx <= dz, dy <= dz, and 3D PF2e distance <= coneLengthFt).
 */
export function computeDragonBreath(
  coneLengthFt: number,
  originHeightFt: number,
): VerticalAoEResult {
  const lengthSq = Math.floor(coneLengthFt / 5);
  const h = Math.max(1, Math.floor(originHeightFt / 5));
  const is15Ft = coneLengthFt === 15;

  if (is15Ft) {
    // 15-ft cone centered on column 0 (origin at x = 0.5, z = h)
    const sideLoX = -3;
    const sideHiX = 4;
    const sideMaxZ = Math.max(h + 2, 5);

    const sideCells: SideViewCell[] = [];
    for (let z = sideMaxZ - 1; z >= 0; z--) {
      const d = h - z; // 1 = immediately below dragon, 2 = 10 ft down, 3 = 15 ft down
      for (let x = sideLoX; x < sideHiX; x++) {
        const perp = Math.abs(x);
        const inCone =
          (d === 1 && perp === 0) || ((d === 2 || d === 3) && perp <= 1);
        const kind: SideCellKind = !inCone
          ? "empty"
          : z === 0
            ? "ground-hit"
            : "air";
        sideCells.push({ x, z, kind });
      }
    }

    const groundLo = -3;
    const groundHi = 4;
    const groundD = h; // distance in squares from z = h to ground cube z = 0
    const groundCells: GroundCell[] = [];
    let groundSquaresHit = 0;
    let maxPerp = -1;

    for (let j = groundHi - 1; j >= groundLo; j--) {
      for (let i = groundLo; i < groundHi; i++) {
        const perpX = Math.abs(i);
        const perpY = Math.abs(j);
        const hit =
          (groundD === 1 && perpX === 0 && perpY === 0) ||
          ((groundD === 2 || groundD === 3) && perpX <= 1 && perpY <= 1);
        if (hit) {
          groundSquaresHit++;
          if (perpX > maxPerp) maxPerp = perpX;
        }
        groundCells.push({ i, j, hit });
      }
    }

    const groundWidthSq = maxPerp >= 0 ? maxPerp * 2 + 1 : 0;
    return {
      sideCells,
      sideLoX,
      sideHiX,
      sideMaxZ,
      sideOrigin: { x: 0.5, z: h },
      groundCells,
      groundLo,
      groundHi,
      groundOrigin: { x: 0.5, y: 0.5 },
      groundSquaresHit,
      effectiveGroundRadiusFt:
        groundWidthSq > 0 ? Math.ceil(groundWidthSq / 2) * 5 : 0,
      groundWidthFt: groundWidthSq * 5,
    };
  }

  // 30-ft+ cone originating from grid intersection (0, 0, h)
  const maxHalfWidth = Math.ceil(lengthSq * 0.75) + 2;
  const sideLoX = -maxHalfWidth;
  const sideHiX = maxHalfWidth;
  const sideMaxZ = Math.max(h + 2, lengthSq + 2);

  const sideCells: SideViewCell[] = [];
  for (let z = sideMaxZ - 1; z >= 0; z--) {
    const dz = h - z; // > 0 means below origin
    for (let x = sideLoX; x < sideHiX; x++) {
      const dx = x >= 0 ? x + 1 : -x;
      const inCone =
        dz >= 1 && dx <= dz && pf2e3DDistance(dx, 1, dz) <= coneLengthFt;
      const kind: SideCellKind = !inCone
        ? "empty"
        : z === 0
          ? "ground-hit"
          : "air";
      sideCells.push({ x, z, kind });
    }
  }

  // Ground-level footprint: a PF2e Burst matching the side-view ground reach
  const groundDz = h;
  let maxGroundReachSq = 0;
  if (groundDz >= 1) {
    for (let dx = 1; dx <= Math.min(groundDz, maxHalfWidth); dx++) {
      if (pf2e3DDistance(dx, 1, groundDz) <= coneLengthFt) {
        maxGroundReachSq = dx;
      }
    }
  }
  const effectiveGroundRadiusFt = maxGroundReachSq * 5;

  const groundLo = -maxHalfWidth;
  const groundHi = maxHalfWidth;
  const groundCells: GroundCell[] = [];
  let groundSquaresHit = 0;

  for (let j = groundHi - 1; j >= groundLo; j--) {
    for (let i = groundLo; i < groundHi; i++) {
      const hit =
        effectiveGroundRadiusFt > 0 &&
        pf2eIntersectionDistance(i, j, 0, 0) <= effectiveGroundRadiusFt;
      if (hit) {
        groundSquaresHit++;
      }
      groundCells.push({ i, j, hit });
    }
  }

  return {
    sideCells,
    sideLoX,
    sideHiX,
    sideMaxZ,
    sideOrigin: { x: 0, z: h },
    groundCells,
    groundLo,
    groundHi,
    groundOrigin: { x: 0, y: 0 },
    groundSquaresHit,
    effectiveGroundRadiusFt,
    groundWidthFt: maxGroundReachSq * 10,
  };
}
