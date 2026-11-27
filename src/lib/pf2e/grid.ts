export type TokenSizeName =
  | "Tiny"
  | "Small"
  | "Medium"
  | "Large"
  | "Huge"
  | "Gargantuan";

export interface TokenSizeInfo {
  name: TokenSizeName;
  squares: number;
  feetLabel: string;
}

export const TOKEN_SIZES: readonly TokenSizeInfo[] = [
  { name: "Tiny", squares: 1, feetLabel: "< 5 ft (1×1 grid)" },
  { name: "Small", squares: 1, feetLabel: "5 ft (1×1)" },
  { name: "Medium", squares: 1, feetLabel: "5 ft (1×1)" },
  { name: "Large", squares: 2, feetLabel: "10 ft (2×2)" },
  { name: "Huge", squares: 3, feetLabel: "15 ft (3×3)" },
  { name: "Gargantuan", squares: 4, feetLabel: "20 ft (4×4)" },
] as const;

export const TOKEN_SIZE_MAP: Record<TokenSizeName, number> = {
  Tiny: 1,
  Small: 1,
  Medium: 1,
  Large: 2,
  Huge: 3,
  Gargantuan: 4,
};

export type AoEType = "emanation" | "burst" | "cone";

export type Direction = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export const DIRECTION_VECTORS: Record<Direction, readonly [number, number]> = {
  N: [0, 1],
  NE: [1, 1],
  E: [1, 0],
  SE: [1, -1],
  S: [0, -1],
  SW: [-1, -1],
  W: [-1, 0],
  NW: [-1, 1],
};

export type CellKind = "empty" | "token" | "affected";

export interface GridCell {
  /** Column coordinate in 5-ft grid units (west to east). */
  i: number;
  /** Row coordinate in 5-ft grid units (south to north). */
  j: number;
  kind: CellKind;
  /** PF2e distance in feet from the origin (0 for caster token squares). */
  distanceFt: number;
  /**
   * Maximum elevation (in feet above ground) a target in this square can occupy
   * and still be hit by the AoE, or null if not hit at any elevation (or N/A for lines).
   */
  maxElevationFt: number | null;
}

export interface GridIntersection {
  /** Grid intersection x-coordinate (border between column x-1 and x). */
  x: number;
  /** Grid intersection y-coordinate (border between row y-1 and y). */
  y: number;
}

export interface AoEConfig {
  type: AoEType;
  /** Caster token size in squares (1–4). Ignored for burst. */
  tokenSize: number;
  /** Emanation/burst radius or cone length in feet. */
  sizeFt: number;
  /** Direction for cone templates. */
  direction: Direction;
}

export interface AoEGridResult {
  cells: GridCell[];
  loX: number;
  hiX: number;
  loY: number;
  hiY: number;
  cols: number;
  rows: number;
  hasCaster: boolean;
  tokenCount: number;
  affectedCount: number;
  /** Grid intersection marker for burst and cone origins. */
  originIntersection: GridIntersection | null;
}

export interface EnemyToken {
  id: number;
  label: string;
  sizeName: TokenSizeName;
  size: number;
  /** Bottom-left column coordinate (west to east). */
  i: number;
  /** Bottom-left row coordinate (south to north). */
  j: number;
  /** Elevation above ground in feet (0 = ground level, multiples of 5). */
  elevationFt: number;
}

/**
 * PF2e alternating diagonal cost in feet: 5, 10, 5, 10, ...
 */
export function diagCost(n: number): number {
  if (n <= 0) return 0;
  return Math.floor(n / 2) * 15 + (n % 2) * 5;
}

/**
 * PF2e 3D grid distance (in feet) across (dx, dy, dz) 5-ft cube deltas.
 * Each 2D or 3D diagonal step counts as one alternating diagonal (5/10/5/10...).
 */
export function pf2e3DDistance(dx: number, dy: number, dz: number): number {
  const [a, b] = [dx, dy, dz].sort((x, y) => y - x);
  return diagCost(b) + (a - b) * 5;
}

/**
 * Computes the maximum elevation (in feet above ground) at which a target
 * occupying square (i, j) is still hit by an emanation, burst, or cone.
 * Returns null if the square cannot be hit at any elevation (or for lines).
 */
export function computeMaxElevationFt(
  i: number,
  j: number,
  config: AoEConfig,
  originIntersection: GridIntersection | null,
): number | null {
  const { type, tokenSize, sizeFt, direction } = config;
  const maxSteps = Math.floor(sizeFt / 5) + tokenSize;

  if (type === "emanation") {
    const dx = Math.max(0, -i, i - tokenSize + 1);
    const dy = Math.max(0, -j, j - tokenSize + 1);
    const isCasterSquare = dx === 0 && dy === 0;
    let maxElev: number | null = null;
    // Start at z = tokenSize for caster squares (above the caster's own height), else z = 0
    const startZ = isCasterSquare ? tokenSize : 0;
    for (let z = startZ; z <= maxSteps; z++) {
      const dz = Math.max(0, z - tokenSize + 1);
      if (pf2e3DDistance(dx, dy, dz) <= sizeFt) {
        maxElev = z * 5;
      } else {
        break;
      }
    }
    return maxElev;
  }

  if (type === "burst") {
    const dx = i >= 0 ? i + 1 : -i;
    const dy = j >= 0 ? j + 1 : -j;
    let maxElev: number | null = null;
    for (let z = 0; z <= maxSteps; z++) {
      const dz = z + 1;
      if (pf2e3DDistance(dx, dy, dz) <= sizeFt) {
        maxElev = z * 5;
      } else {
        break;
      }
    }
    return maxElev;
  }

  if (type === "cone" && originIntersection) {
    const [dirX, dirY] = DIRECTION_VECTORS[direction];

    if (is15FtOrthogonalCone(direction, sizeFt)) {
      const center = Math.floor((tokenSize - 1) / 2);
      const d =
        dirX === 1
          ? i - (tokenSize - 1)
          : dirX === -1
            ? -i
            : dirY === 1
              ? j - (tokenSize - 1)
              : -j;
      const perp = dirX !== 0 ? Math.abs(j - center) : Math.abs(i - center);
      const in2D =
        (d === 1 && perp === 0) || ((d === 2 || d === 3) && perp <= 1);
      if (!in2D) return null;

      // Vertical spread mirrors horizontal spread: 0 cubes above caster top at d=1, up to 1 cube at d=2,3
      const maxDz = d === 1 ? 0 : 1;
      const dx = Math.max(0, -i, i - tokenSize + 1);
      const dy = Math.max(0, -j, j - tokenSize + 1);
      let maxElev = 0;
      for (let z = 0; z <= tokenSize - 1 + maxDz; z++) {
        const dz = Math.max(0, z - tokenSize + 1);
        if (dz <= maxDz && pf2e3DDistance(dx, dy, dz) <= sizeFt) {
          maxElev = z * 5;
        }
      }
      return maxElev;
    }

    const { x: ox, y: oy } = originIntersection;
    if (!isInCone(i, j, tokenSize, ox, oy, direction, sizeFt).affected) {
      return null;
    }
    const dx = i >= ox ? i - ox + 1 : ox - i;
    const dy = j >= oy ? j - oy + 1 : oy - j;
    const forward =
      dirX !== 0 && dirY !== 0
        ? Math.max(dx, dy)
        : dirX !== 0
          ? dx
          : dy;

    let maxElev: number | null = null;
    for (let z = 0; z <= maxSteps; z++) {
      const dz = z + 1;
      if (dz <= forward && pf2e3DDistance(dx, dy, dz) <= sizeFt) {
        maxElev = z * 5;
      } else {
        break;
      }
    }
    return maxElev;
  }

  return null;
}

/**
 * PF2e grid distance (in feet) from a token occupying squares
 * [0, tokenSize - 1] × [0, tokenSize - 1] to the square at position (i, j).
 * Uses the alternating-diagonal rule: every 2nd diagonal costs 10 ft instead of 5 ft.
 */
export function pf2eDistance(i: number, j: number, tokenSize: number): number {
  const dx = Math.max(0, -i, i - tokenSize + 1);
  const dy = Math.max(0, -j, j - tokenSize + 1);
  const diag = Math.min(dx, dy);
  const straight = Math.abs(dx - dy);
  return diagCost(diag) + straight * 5;
}

/**
 * PF2e grid distance (in feet) from a grid intersection (ox, oy) to square (i, j).
 * Squares immediately adjacent to the intersection have dx = 1, dy = 1 -> 5 ft.
 */
export function pf2eIntersectionDistance(
  i: number,
  j: number,
  ox: number,
  oy: number,
): number {
  const dx = i >= ox ? i - ox + 1 : ox - i;
  const dy = j >= oy ? j - oy + 1 : oy - j;
  const diag = Math.min(dx, dy);
  const straight = Math.abs(dx - dy);
  return diagCost(diag) + straight * 5;
}

/**
 * Returns true if the cone uses PF2e's 15-ft orthogonal edge-centered 1-3-3 template.
 */
function is15FtOrthogonalCone(direction: Direction, lengthFt: number): boolean {
  const [dirX, dirY] = DIRECTION_VECTORS[direction];
  return lengthFt === 15 && (dirX === 0 || dirY === 0);
}

/**
 * Returns the origin point (grid intersection, or edge midpoint for a 15-ft orthogonal cone)
 * for a cone originating from a caster occupying [0, tokenSize - 1]² in the given direction.
 */
export function getConeOrigin(
  tokenSize: number,
  direction: Direction,
  lengthFt = 30,
): GridIntersection {
  const [dirX, dirY] = DIRECTION_VECTORS[direction];
  if (is15FtOrthogonalCone(direction, lengthFt)) {
    const center = Math.floor((tokenSize - 1) / 2) + 0.5;
    const x = dirX === 1 ? tokenSize : dirX === -1 ? 0 : center;
    const y = dirY === 1 ? tokenSize : dirY === -1 ? 0 : center;
    return { x, y };
  }
  const mid = Math.ceil(tokenSize / 2);
  const x = dirX === 1 ? tokenSize : dirX === -1 ? 0 : mid;
  const y = dirY === 1 ? tokenSize : dirY === -1 ? 0 : mid;
  return { x, y };
}

/**
 * Checks whether square (i, j) falls inside a PF2e 90-degree cone from origin (ox, oy).
 */
function isInCone(
  i: number,
  j: number,
  tokenSize: number,
  ox: number,
  oy: number,
  direction: Direction,
  lengthFt: number,
): { affected: boolean; distanceFt: number } {
  const [dirX, dirY] = DIRECTION_VECTORS[direction];

  // PF2e 15-ft orthogonal cone: edge-centered 1-3-3 pattern (7 squares)
  if (is15FtOrthogonalCone(direction, lengthFt)) {
    const center = Math.floor((tokenSize - 1) / 2);
    const distanceFt = pf2eDistance(i, j, tokenSize);
    const d =
      dirX === 1
        ? i - (tokenSize - 1)
        : dirX === -1
          ? -i
          : dirY === 1
            ? j - (tokenSize - 1)
            : -j;
    const perp =
      dirX !== 0 ? Math.abs(j - center) : Math.abs(i - center);
    const affected =
      (d === 1 && perp === 0) || ((d === 2 || d === 3) && perp <= 1);
    return { affected, distanceFt };
  }

  const distanceFt = pf2eIntersectionDistance(i, j, ox, oy);
  if (distanceFt > lengthFt) {
    return { affected: false, distanceFt };
  }

  const dx = i >= ox ? i - ox + 1 : ox - i;
  const dy = j >= oy ? j - oy + 1 : oy - j;

  // Diagonal cone: covers the full 90-degree quadrant in (dirX, dirY)
  if (dirX !== 0 && dirY !== 0) {
    const inX = dirX > 0 ? i >= ox : i < ox;
    const inY = dirY > 0 ? j >= oy : j < oy;
    return { affected: inX && inY, distanceFt };
  }

  // Orthogonal cone (30 ft+): extends along the primary axis from a corner intersection
  if (dirX !== 0) {
    const inFront = dirX > 0 ? i >= ox : i < ox;
    return { affected: inFront && dy <= dx, distanceFt };
  } else {
    const inFront = dirY > 0 ? j >= oy : j < oy;
    return { affected: inFront && dx <= dy, distanceFt };
  }
}

/**
 * Computes the 2D grid of squares for a PF2e Area of Effect (emanation, burst, cone).
 * Cells are returned in visual row-major order (north-up: highest j first, then increasing i).
 */
export function computeAoEGrid(config: AoEConfig): AoEGridResult {
  const { type, tokenSize, sizeFt, direction } = config;
  const hasCaster = type !== "burst";
  const radiusSq = Math.floor(sizeFt / 5);
  const pad = 2;

  let loX: number;
  let hiX: number;
  let loY: number;
  let hiY: number;
  let originIntersection: GridIntersection | null = null;

  if (type === "burst") {
    originIntersection = { x: 0, y: 0 };
    const half = radiusSq + pad;
    loX = -half;
    hiX = half;
    loY = -half;
    hiY = half;
  } else if (type === "emanation") {
    const extent = radiusSq + pad;
    loX = -extent;
    hiX = tokenSize + extent;
    loY = -extent;
    hiY = tokenSize + extent;
  } else {
    // Cone: keep a square viewport that comfortably frames caster + full AoE
    originIntersection = getConeOrigin(tokenSize, direction, sizeFt);
    const [dirX, dirY] = DIRECTION_VECTORS[direction];

    let minI = 0;
    let maxI = tokenSize - 1;
    let minJ = 0;
    let maxJ = tokenSize - 1;

    const ox = Math.floor(originIntersection.x);
    const oy = Math.floor(originIntersection.y);
    minI = Math.min(minI, dirX > 0 ? ox : ox - radiusSq);
    maxI = Math.max(maxI, dirX < 0 ? ox : ox + radiusSq);
    minJ = Math.min(minJ, dirY > 0 ? oy : oy - radiusSq);
    maxJ = Math.max(maxJ, dirY < 0 ? oy : oy + radiusSq);

    minI -= pad;
    maxI += pad;
    minJ -= pad;
    maxJ += pad;

    // Normalize to a square grid centered on the bounding box
    const spanX = maxI - minI + 1;
    const spanY = maxJ - minJ + 1;
    const side = Math.max(spanX, spanY, tokenSize + 6);
    const extraX = side - spanX;
    const extraY = side - spanY;

    loX = minI - Math.floor(extraX / 2);
    hiX = loX + side;
    loY = minJ - Math.floor(extraY / 2);
    hiY = loY + side;
  }

  const cells: GridCell[] = [];
  let tokenCount = 0;
  let affectedCount = 0;

  for (let j = hiY - 1; j >= loY; j--) {
    for (let i = loX; i < hiX; i++) {
      const isToken =
        hasCaster && i >= 0 && i < tokenSize && j >= 0 && j < tokenSize;

      if (isToken) {
        tokenCount++;
        const maxElevationFt =
          type === "emanation"
            ? computeMaxElevationFt(i, j, config, originIntersection)
            : null;
        cells.push({ i, j, kind: "token", distanceFt: 0, maxElevationFt });
        continue;
      }

      if (type === "emanation") {
        const distanceFt = pf2eDistance(i, j, tokenSize);
        if (distanceFt <= sizeFt) {
          affectedCount++;
          const maxElevationFt = computeMaxElevationFt(
            i,
            j,
            config,
            originIntersection,
          );
          cells.push({ i, j, kind: "affected", distanceFt, maxElevationFt });
        } else {
          cells.push({
            i,
            j,
            kind: "empty",
            distanceFt,
            maxElevationFt: null,
          });
        }
      } else if (type === "burst") {
        const distanceFt = pf2eIntersectionDistance(i, j, 0, 0);
        if (distanceFt <= sizeFt) {
          affectedCount++;
          const maxElevationFt = computeMaxElevationFt(
            i,
            j,
            config,
            originIntersection,
          );
          cells.push({ i, j, kind: "affected", distanceFt, maxElevationFt });
        } else {
          cells.push({
            i,
            j,
            kind: "empty",
            distanceFt,
            maxElevationFt: null,
          });
        }
      } else if (type === "cone" && originIntersection) {
        const { affected, distanceFt } = isInCone(
          i,
          j,
          tokenSize,
          originIntersection.x,
          originIntersection.y,
          direction,
          sizeFt,
        );
        if (affected) {
          affectedCount++;
          const maxElevationFt = computeMaxElevationFt(
            i,
            j,
            config,
            originIntersection,
          );
          cells.push({ i, j, kind: "affected", distanceFt, maxElevationFt });
        } else {
          cells.push({
            i,
            j,
            kind: "empty",
            distanceFt,
            maxElevationFt: null,
          });
        }
      }
    }
  }

  return {
    cells,
    loX,
    hiX,
    loY,
    hiY,
    cols: hiX - loX,
    rows: hiY - loY,
    hasCaster,
    tokenCount,
    affectedCount,
    originIntersection,
  };
}

/**
 * Convenience wrapper for emanation grids.
 */
export function computeEmanationGrid(
  tokenSize: number,
  emanationFt: number,
): AoEGridResult {
  return computeAoEGrid({
    type: "emanation",
    tokenSize,
    sizeFt: emanationFt,
    direction: "E",
  });
}

/**
 * Minimum 3D PF2e distance (in feet) between the AoE origin (caster token or burst intersection)
 * and any square occupied by the enemy token at its current elevation.
 */
export function enemyDistanceToOrigin(
  enemy: Pick<EnemyToken, "i" | "j" | "size"> & { elevationFt?: number },
  config: AoEConfig,
): number {
  const z0 = Math.max(0, Math.floor((enemy.elevationFt ?? 0) / 5));
  let minDist = Infinity;
  for (let x = enemy.i; x < enemy.i + enemy.size; x++) {
    for (let y = enemy.j; y < enemy.j + enemy.size; y++) {
      let d: number;
      if (config.type === "burst") {
        const dx = x >= 0 ? x + 1 : -x;
        const dy = y >= 0 ? y + 1 : -y;
        const dz = z0 + 1;
        d = pf2e3DDistance(dx, dy, dz);
      } else {
        const dx = Math.max(0, -x, x - config.tokenSize + 1);
        const dy = Math.max(0, -y, y - config.tokenSize + 1);
        const dz = Math.max(0, z0 - config.tokenSize + 1);
        d = pf2e3DDistance(dx, dy, dz);
      }
      if (d < minDist) minDist = d;
    }
  }
  return minDist;
}

/**
 * Returns true if any square occupied by the enemy token (at its elevation) falls inside the AoE.
 */
export function isEnemyHitByAoE(
  enemy: Pick<EnemyToken, "i" | "j" | "size"> & { elevationFt?: number },
  config: AoEConfig,
  includeToken = false,
): boolean {
  const { type, tokenSize, direction, sizeFt } = config;
  const elevationFt = Math.max(0, enemy.elevationFt ?? 0);
  const originIntersection =
    type === "burst"
      ? { x: 0, y: 0 }
      : type === "cone"
        ? getConeOrigin(tokenSize, direction, sizeFt)
        : null;

  for (let x = enemy.i; x < enemy.i + enemy.size; x++) {
    for (let y = enemy.j; y < enemy.j + enemy.size; y++) {
      if (type === "emanation") {
        const inCaster = x >= 0 && x < tokenSize && y >= 0 && y < tokenSize;
        if (inCaster && elevationFt < tokenSize * 5) {
          if (includeToken) return true;
          continue;
        }
      }
      const maxElev = computeMaxElevationFt(x, y, config, originIntersection);
      if (maxElev !== null && elevationFt <= maxElev) {
        return true;
      }
    }
  }
  return false;
}

function rectsOverlap(
  aI: number,
  aJ: number,
  aSize: number,
  bI: number,
  bJ: number,
  bSize: number,
): boolean {
  return (
    aI < bI + bSize &&
    aI + aSize > bI &&
    aJ < bJ + bSize &&
    aJ + aSize > bJ
  );
}

/**
 * Checks whether an enemy token of `size × size` with bottom-left at (i, j)
 * fits within [loX, hiX) × [loY, hiY) without overlapping the caster (if present) or existing enemies.
 */
export function canPlaceEnemy(
  i: number,
  j: number,
  size: number,
  hasCaster: boolean,
  casterSize: number,
  existingEnemies: readonly EnemyToken[],
  loX: number,
  hiX: number,
  loY: number,
  hiY: number,
): boolean {
  if (i < loX || j < loY || i + size > hiX || j + size > hiY) {
    return false;
  }
  if (hasCaster && rectsOverlap(i, j, size, 0, 0, casterSize)) {
    return false;
  }
  for (const enemy of existingEnemies) {
    if (rectsOverlap(i, j, size, enemy.i, enemy.j, enemy.size)) {
      return false;
    }
  }
  return true;
}
