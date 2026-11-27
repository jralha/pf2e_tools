import {
  TOKEN_SIZE_MAP,
  wallKey,
  type EnemyToken,
  type TokenSizeName,
} from "./pf2e/grid";

const VALID_SIZES = new Set<string>(Object.keys(TOKEN_SIZE_MAP));

export function parseTokenSize(
  raw: string | null,
  fallback: TokenSizeName,
): TokenSizeName {
  return raw && VALID_SIZES.has(raw) ? (raw as TokenSizeName) : fallback;
}

export function parseSteppedInt(
  raw: string | null,
  min: number,
  max: number,
  step: number,
  fallback: number,
): number {
  if (raw === null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const clamped = Math.max(min, Math.min(max, Math.round(n / step) * step));
  return clamped;
}

/**
 * Compactly encodes enemy tokens for URL query params:
 * `i,j,SizeName,elevationFt;...`
 */
export function encodeEnemies(enemies: readonly EnemyToken[]): string {
  return enemies
    .map((e) => `${e.i},${e.j},${e.sizeName},${e.elevationFt}`)
    .join(";");
}

/**
 * Decodes enemy tokens from URL query params. Invalid entries are skipped.
 */
export function decodeEnemies(raw: string | null): EnemyToken[] {
  if (!raw) return [];
  const result: EnemyToken[] = [];
  let id = 1;
  for (const part of raw.split(";")) {
    if (!part) continue;
    const [iStr, jStr, sizeStr, elevStr] = part.split(",");
    const i = Number(iStr);
    const j = Number(jStr);
    const sizeName = parseTokenSize(sizeStr ?? null, "Medium");
    const elevationFt = parseSteppedInt(elevStr ?? "0", 0, 120, 5, 0);
    if (!Number.isInteger(i) || !Number.isInteger(j)) continue;
    result.push({
      id,
      label: `E${id}`,
      sizeName,
      size: TOKEN_SIZE_MAP[sizeName],
      i,
      j,
      elevationFt,
    });
    id++;
  }
  return result;
}

/**
 * Compactly encodes wall square keys ("i,j") for URL query params: `i,j;i,j;...`
 */
export function encodeWalls(walls: ReadonlySet<string>): string {
  return Array.from(walls).sort().join(";");
}

/**
 * Decodes wall square keys from URL query params.
 */
export function decodeWalls(raw: string | null): Set<string> {
  const set = new Set<string>();
  if (!raw) return set;
  for (const part of raw.split(";")) {
    if (!part) continue;
    const [iStr, jStr] = part.split(",");
    const i = Number(iStr);
    const j = Number(jStr);
    if (Number.isInteger(i) && Number.isInteger(j)) {
      set.add(wallKey(i, j));
    }
  }
  return set;
}
