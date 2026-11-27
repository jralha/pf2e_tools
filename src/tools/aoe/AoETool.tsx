import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  BrickWall,
  Compass,
  Radar,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  DIRECTION_VECTORS,
  TOKEN_SIZES,
  TOKEN_SIZE_MAP,
  computeAoEGrid,
  enemyDistanceToOrigin,
  isEnemyHitByAoE,
  wallKey,
  type AoEConfig,
  type AoEType,
  type Direction,
  type EnemyToken,
  type TokenSizeName,
} from "../../lib/pf2e/grid";
import {
  decodeEnemies,
  decodeWalls,
  encodeEnemies,
  encodeWalls,
  parseSteppedInt,
  parseTokenSize,
} from "../../lib/urlState";
import { ShareLinkButton } from "../../components/ShareLinkButton";
import { CopyImageButton } from "../../components/CopyImageButton";
import { EnemyTokensCard } from "../../components/EnemyTokensCard";
import { AoEGrid, type MapInteractMode } from "./AoEGrid";

interface AoETypeMeta {
  id: AoEType;
  label: string;
  sizeLabel: string;
  minFt: number;
  maxFt: number;
  defaultFt: number;
  presets: readonly number[];
  description: string;
}

const AOE_TYPES: readonly AoETypeMeta[] = [
  {
    id: "emanation",
    label: "Emanation",
    sizeLabel: "Emanation Radius",
    minFt: 5,
    maxFt: 120,
    defaultFt: 10,
    presets: [5, 10, 15, 20, 30, 60],
    description: "Radiates outward from every edge of the caster's space.",
  },
  {
    id: "burst",
    label: "Burst",
    sizeLabel: "Burst Radius",
    minFt: 5,
    maxFt: 120,
    defaultFt: 20,
    presets: [5, 10, 15, 20, 30, 60],
    description: "Spreads in all directions from a single grid intersection.",
  },
  {
    id: "cone",
    label: "Cone",
    sizeLabel: "Cone Length",
    minFt: 15,
    maxFt: 120,
    defaultFt: 15,
    presets: [15, 30, 45, 60],
    description: "90° wedge originating from the caster's space.",
  },
];

const COMPASS_GRID: readonly (
  | { dir: Direction; icon: LucideIcon }
  | null
)[] = [
  { dir: "NW", icon: ArrowUpLeft },
  { dir: "N", icon: ArrowUp },
  { dir: "NE", icon: ArrowUpRight },
  { dir: "W", icon: ArrowLeft },
  null,
  { dir: "E", icon: ArrowRight },
  { dir: "SW", icon: ArrowDownLeft },
  { dir: "S", icon: ArrowDown },
  { dir: "SE", icon: ArrowDownRight },
];

const VALID_AOE_TYPES = new Set<string>(["emanation", "burst", "cone"]);
const VALID_DIRECTIONS = new Set<string>(Object.keys(DIRECTION_VECTORS));

export default function AoETool() {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialType: AoEType = VALID_AOE_TYPES.has(searchParams.get("t") ?? "")
    ? (searchParams.get("t") as AoEType)
    : "emanation";
  const initialMeta =
    AOE_TYPES.find((t) => t.id === initialType) ?? AOE_TYPES[0];
  const initialEnemies = useMemo(
    () => decodeEnemies(searchParams.get("en")),
    // Only hydrate on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [aoeType, setAoeType] = useState<AoEType>(initialType);
  const [sizeLabel, setSizeLabel] = useState<TokenSizeName>(() =>
    parseTokenSize(searchParams.get("c"), "Medium"),
  );
  const [sizeFt, setSizeFt] = useState<number>(() =>
    parseSteppedInt(
      searchParams.get("s"),
      initialMeta.minFt,
      initialMeta.maxFt,
      5,
      initialMeta.defaultFt,
    ),
  );
  const [direction, setDirection] = useState<Direction>(() => {
    const raw = searchParams.get("d");
    return raw && VALID_DIRECTIONS.has(raw) ? (raw as Direction) : "E";
  });
  const [includeToken, setIncludeToken] = useState<boolean>(
    () => searchParams.get("inc") === "1",
  );
  const [showElevation, setShowElevation] = useState<boolean>(
    () => searchParams.get("elev") === "1",
  );

  const [interactMode, setInteractMode] = useState<MapInteractMode>("enemy");
  const [enemySizeLabel, setEnemySizeLabel] = useState<TokenSizeName>("Medium");
  const [enemies, setEnemies] = useState<EnemyToken[]>(initialEnemies);
  const [walls, setWalls] = useState<Set<string>>(() =>
    decodeWalls(searchParams.get("w")),
  );
  const nextEnemyId = useRef(
    initialEnemies.reduce((max, e) => Math.max(max, e.id), 0) + 1,
  );
  const gridSvgRef = useRef<SVGSVGElement | null>(null);

  // Sync state to URL query params for easy sharing
  useEffect(() => {
    const next = new URLSearchParams();
    next.set("t", aoeType);
    next.set("s", String(sizeFt));
    if (aoeType !== "burst") next.set("c", sizeLabel);
    if (aoeType === "cone") next.set("d", direction);
    if (aoeType === "emanation" && includeToken) next.set("inc", "1");
    if (showElevation) next.set("elev", "1");
    if (enemies.length > 0) next.set("en", encodeEnemies(enemies));
    if (walls.size > 0) next.set("w", encodeWalls(walls));
    setSearchParams(next, { replace: true });
  }, [
    aoeType,
    sizeFt,
    sizeLabel,
    direction,
    includeToken,
    showElevation,
    enemies,
    walls,
    setSearchParams,
  ]);

  const meta = AOE_TYPES.find((t) => t.id === aoeType) ?? AOE_TYPES[0];
  const tokenSize = TOKEN_SIZE_MAP[sizeLabel];
  const enemyPlaceSize = TOKEN_SIZE_MAP[enemySizeLabel];

  const config: AoEConfig = useMemo(
    () => ({
      type: aoeType,
      tokenSize,
      sizeFt,
      direction,
      walls,
    }),
    [aoeType, tokenSize, sizeFt, direction, walls],
  );

  const grid = useMemo(() => computeAoEGrid(config), [config]);

  const effectiveIncludeToken = aoeType === "emanation" && includeToken;
  const totalSquares =
    grid.affectedCount + (effectiveIncludeToken ? grid.tokenCount : 0);

  const enemySummaries = useMemo(
    () =>
      enemies.map((enemy) => {
        const distanceFt = enemyDistanceToOrigin(enemy, config);
        const hit = isEnemyHitByAoE(enemy, config, effectiveIncludeToken);
        return {
          enemy,
          subtitle: `${enemy.sizeName} · ${distanceFt} ft`,
          hit,
        };
      }),
    [enemies, config, effectiveIncludeToken],
  );

  const enemiesHitCount = enemySummaries.filter((e) => e.hit).length;

  const filterOverlappingCaster = (
    list: EnemyToken[],
    casterSize: number,
  ): EnemyToken[] =>
    list.filter(
      (e) =>
        !(
          e.i < casterSize &&
          e.i + e.size > 0 &&
          e.j < casterSize &&
          e.j + e.size > 0
        ),
    );

  const filterWallsOverlappingCaster = (
    prev: Set<string>,
    casterSize: number,
  ): Set<string> => {
    const next = new Set(prev);
    for (let x = 0; x < casterSize; x++) {
      for (let y = 0; y < casterSize; y++) {
        next.delete(wallKey(x, y));
      }
    }
    return next;
  };

  const handleAoETypeChange = (nextType: AoEType) => {
    const nextMeta = AOE_TYPES.find((t) => t.id === nextType) ?? AOE_TYPES[0];
    setAoeType(nextType);
    setSizeFt(nextMeta.defaultFt);
    if (nextType !== "burst") {
      setEnemies((prev) => filterOverlappingCaster(prev, tokenSize));
      setWalls((prev) => filterWallsOverlappingCaster(prev, tokenSize));
    }
  };

  const handleSizeChange = (newSizeLabel: TokenSizeName) => {
    const newCasterSize = TOKEN_SIZE_MAP[newSizeLabel];
    setSizeLabel(newSizeLabel);
    if (aoeType !== "burst") {
      setEnemies((prev) => filterOverlappingCaster(prev, newCasterSize));
      setWalls((prev) => filterWallsOverlappingCaster(prev, newCasterSize));
    }
  };

  const handlePlaceEnemy = (i: number, j: number) => {
    const id = nextEnemyId.current++;
    setEnemies((prev) => [
      ...prev,
      {
        id,
        label: `E${id}`,
        sizeName: enemySizeLabel,
        size: enemyPlaceSize,
        i,
        j,
        elevationFt: 0,
      },
    ]);
  };

  const handleEnemyElevationChange = (id: number, deltaFt: number) => {
    setEnemies((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              elevationFt: Math.max(0, Math.min(120, e.elevationFt + deltaFt)),
            }
          : e,
      ),
    );
  };

  const handleRemoveEnemy = (id: number) => {
    setEnemies((prev) => prev.filter((e) => e.id !== id));
  };

  const handleClearEnemies = () => {
    setEnemies([]);
    nextEnemyId.current = 1;
  };

  const handleSetWall = (i: number, j: number, add: boolean) => {
    const key = wallKey(i, j);
    setWalls((prev) => {
      if (add && prev.has(key)) return prev;
      if (!add && !prev.has(key)) return prev;
      const next = new Set(prev);
      if (add) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const handleClearWalls = () => setWalls(new Set());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-crimson-600 dark:text-zinc-400 dark:hover:text-gold-400 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to All Tools
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-crimson-600/10 text-crimson-700 dark:bg-crimson-600/20 dark:text-gold-400 ring-1 ring-crimson-600/15 dark:ring-gold-500/20">
              <Radar className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-zinc-50">
                PF2e AoE Calculator
              </h1>
              <p className="text-sm text-stone-600 dark:text-zinc-400">
                Emanations, Bursts &amp; Cones · 5-foot grid ·
                alternating-diagonal rule
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CopyImageButton
              svgRef={gridSvgRef}
              title={
                aoeType === "burst"
                  ? `${sizeFt} ft Burst`
                  : aoeType === "emanation"
                    ? `${sizeLabel} (${tokenSize}×${tokenSize}) — ${sizeFt} ft Emanation`
                    : `${sizeLabel} (${tokenSize}×${tokenSize}) — ${sizeFt} ft Cone (${direction})`
              }
              subtitle={`${totalSquares} squares affected${
                enemies.length > 0
                  ? ` · ${enemiesHitCount}/${enemies.length} enemies hit`
                  : ""
              }`}
              filename={`pf2e-${aoeType}-${sizeFt}ft.png`}
            />
            <ShareLinkButton />
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls & Metrics */}
        <div className="lg:col-span-5 space-y-5">
          {/* Metric Summary */}
          <div className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-5 shadow-xs">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                  Squares Affected
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-4xl font-bold tabular-nums text-crimson-700 dark:text-gold-400">
                    {totalSquares}
                  </span>
                  <span className="text-sm text-stone-500 dark:text-zinc-400">
                    sq ({totalSquares * 25} sq ft)
                  </span>
                </div>
              </div>

              {enemies.length > 0 && (
                <div className="text-right">
                  <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                    Enemies Hit
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-stone-900 dark:text-zinc-100">
                    <span className="text-crimson-600 dark:text-crimson-400">
                      {enemiesHitCount}
                    </span>
                    <span className="text-base font-normal text-stone-400 dark:text-zinc-500">
                      {" "}
                      / {enemies.length}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-stone-100 dark:border-zinc-800 space-y-1.5 text-xs text-stone-600 dark:text-zinc-400">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  {meta.label} area:{" "}
                  <strong className="text-stone-900 dark:text-zinc-100">
                    {grid.affectedCount}
                  </strong>{" "}
                  sq
                </span>
                {aoeType === "emanation" && (
                  <span>
                    Caster space:{" "}
                    <strong className="text-stone-900 dark:text-zinc-100">
                      {grid.tokenCount}
                    </strong>{" "}
                    sq {effectiveIncludeToken ? "(included)" : "(excluded)"}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-500 dark:text-zinc-500">
                Note: Only counts Small/Medium enemies at ground level.
              </p>
            </div>
          </div>

          {/* Controls Card */}
          <div className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-5 shadow-xs space-y-5">
            {/* AoE Type Tabs */}
            <div className="space-y-2">
              <span className="block text-sm font-medium text-stone-800 dark:text-zinc-200">
                Area Shape
              </span>
              <div
                className="grid grid-cols-3 gap-1 rounded-lg bg-stone-100 dark:bg-zinc-950 p-1 border border-stone-200 dark:border-zinc-800"
                role="tablist"
                aria-label="Area of Effect shape"
              >
                {AOE_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={aoeType === t.id}
                    onClick={() => handleAoETypeChange(t.id)}
                    className={`rounded-md py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      aoeType === t.id
                        ? "bg-crimson-600 text-white shadow-xs dark:bg-gold-500 dark:text-zinc-950"
                        : "text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                {meta.description}
              </p>
            </div>

            {/* Caster Token Size (Emanation, Cone) */}
            {aoeType !== "burst" && (
              <div className="space-y-2">
                <label
                  htmlFor="token-size"
                  className="block text-sm font-medium text-stone-800 dark:text-zinc-200"
                >
                  Caster Token Size
                </label>
                <select
                  id="token-size"
                  value={sizeLabel}
                  onChange={(e) =>
                    handleSizeChange(e.target.value as TokenSizeName)
                  }
                  className="w-full rounded-lg border border-stone-300 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 px-3 py-2 text-sm text-stone-900 dark:text-zinc-100 focus:border-crimson-600 dark:focus:border-gold-400 focus:outline-none"
                >
                  {TOKEN_SIZES.map((size) => (
                    <option key={size.name} value={size.name}>
                      {size.name} — {size.feetLabel}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Distance / Size Slider */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="aoe-size-ft"
                  className="text-sm font-medium text-stone-800 dark:text-zinc-200"
                >
                  {meta.sizeLabel}
                </label>
                <span className="text-sm font-semibold tabular-nums text-crimson-700 dark:text-gold-400">
                  {sizeFt} ft
                </span>
              </div>

              <input
                id="aoe-size-ft"
                type="range"
                min={meta.minFt}
                max={meta.maxFt}
                step={5}
                value={sizeFt}
                onChange={(e) => setSizeFt(Number(e.target.value))}
                className="w-full accent-crimson-600 dark:accent-gold-400 cursor-pointer"
              />

              <div className="flex flex-wrap gap-1.5 pt-1">
                {meta.presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSizeFt(preset)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      sizeFt === preset
                        ? "bg-crimson-600 text-white dark:bg-gold-500 dark:text-zinc-950"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {preset} ft
                  </button>
                ))}
              </div>
            </div>

            {/* Direction Compass (Cone) */}
            {aoeType === "cone" && (
              <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-stone-800 dark:text-zinc-200">
                    Direction
                  </span>
                  <span className="text-xs font-semibold text-crimson-700 dark:text-gold-400">
                    {direction}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 w-36 mx-auto">
                  {COMPASS_GRID.map((entry, idx) =>
                    entry === null ? (
                      <div
                        key={`center-${idx}`}
                        className="flex h-9 w-full items-center justify-center rounded-md bg-stone-100/70 dark:bg-zinc-950 text-stone-400 dark:text-zinc-600"
                      >
                        <Compass className="h-4 w-4" />
                      </div>
                    ) : (
                      <button
                        key={entry.dir}
                        type="button"
                        onClick={() => setDirection(entry.dir)}
                        aria-label={`Aim ${entry.dir}`}
                        title={entry.dir}
                        className={`flex h-9 w-full items-center justify-center rounded-md border text-xs font-semibold transition-colors cursor-pointer ${
                          direction === entry.dir
                            ? "border-crimson-600 bg-crimson-600 text-white dark:border-gold-500 dark:bg-gold-500 dark:text-zinc-950"
                            : "border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950 text-stone-700 dark:text-zinc-300 hover:bg-stone-200/70 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <entry.icon className="h-4 w-4" />
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}

            {/* Map Brush Mode (Enemies vs Walls) */}
            <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-stone-800 dark:text-zinc-200">
                  Map Click Mode
                </span>
                {walls.size > 0 && (
                  <button
                    type="button"
                    onClick={handleClearWalls}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-stone-500 hover:text-crimson-600 hover:bg-stone-100 dark:text-zinc-400 dark:hover:text-crimson-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear walls ({walls.size})
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setInteractMode("enemy")}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    interactMode === "enemy"
                      ? "border-crimson-600 bg-crimson-600 text-white dark:border-gold-500 dark:bg-gold-500 dark:text-zinc-950"
                      : "border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950 text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  Place Enemies
                </button>
                <button
                  type="button"
                  onClick={() => setInteractMode("wall")}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    interactMode === "wall"
                      ? "border-crimson-600 bg-crimson-600 text-white dark:border-gold-500 dark:bg-gold-500 dark:text-zinc-950"
                      : "border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950 text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <BrickWall className="h-3.5 w-3.5" />
                  Paint Walls
                </button>
              </div>
            </div>

            {/* Show Max Elevation Toggle */}
            <label className="flex items-start gap-3 pt-2 border-t border-stone-100 dark:border-zinc-800 cursor-pointer">
              <input
                type="checkbox"
                checked={showElevation}
                onChange={(e) => setShowElevation(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-stone-300 dark:border-zinc-700 accent-crimson-600 dark:accent-gold-400 cursor-pointer"
              />
              <span className="text-sm text-stone-700 dark:text-zinc-300">
                <span className="font-medium text-stone-900 dark:text-zinc-100">
                  Show max elevation per square (ft)
                </span>
                <span className="block mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
                  Displays the highest elevation a target can occupy in each
                  space and still be hit.
                </span>
              </span>
            </label>

            {/* Include Token Checkbox (Emanation only) */}
            {aoeType === "emanation" && (
              <label className="flex items-start gap-3 pt-2 border-t border-stone-100 dark:border-zinc-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeToken}
                  onChange={(e) => setIncludeToken(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 dark:border-zinc-700 accent-crimson-600 dark:accent-gold-400 cursor-pointer"
                />
                <span className="text-sm text-stone-700 dark:text-zinc-300">
                  <span className="font-medium text-stone-900 dark:text-zinc-100">
                    Include caster&apos;s own squares in the count
                  </span>
                  <span className="block mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
                    In PF2e, the creature creating an emanation chooses whether
                    its own space is affected unless stated otherwise.
                  </span>
                </span>
              </label>
            )}
          </div>

          {/* Enemy Tokens Card */}
          <EnemyTokensCard
            items={enemySummaries}
            enemySizeLabel={enemySizeLabel}
            onEnemySizeChange={setEnemySizeLabel}
            onElevationChange={handleEnemyElevationChange}
            onRemoveEnemy={handleRemoveEnemy}
            onClearEnemies={handleClearEnemies}
            emptyHint="No enemies placed yet. Switch to Place Enemies and click any open square on the grid."
          />
        </div>

        {/* SVG Grid */}
        <div className="lg:col-span-7">
          <AoEGrid
            config={config}
            sizeLabel={sizeLabel}
            includeToken={effectiveIncludeToken}
            showElevation={showElevation}
            interactMode={interactMode}
            grid={grid}
            enemies={enemies}
            walls={walls}
            enemyPlaceSize={enemyPlaceSize}
            onPlaceEnemy={handlePlaceEnemy}
            onRemoveEnemy={handleRemoveEnemy}
            onSetWall={handleSetWall}
            svgRef={gridSvgRef}
          />
        </div>
      </div>
    </div>
  );
}
