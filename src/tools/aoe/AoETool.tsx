import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Compass,
  Minus,
  Plus,
  Radar,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  TOKEN_SIZES,
  TOKEN_SIZE_MAP,
  computeAoEGrid,
  enemyDistanceToOrigin,
  isEnemyHitByAoE,
  type AoEConfig,
  type AoEType,
  type Direction,
  type EnemyToken,
  type TokenSizeName,
} from "../../lib/pf2e/grid";
import { AoEGrid } from "./AoEGrid";

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

export default function AoETool() {
  const [aoeType, setAoeType] = useState<AoEType>("emanation");
  const [sizeLabel, setSizeLabel] = useState<TokenSizeName>("Medium");
  const [sizeFt, setSizeFt] = useState<number>(10);
  const [direction, setDirection] = useState<Direction>("E");
  const [includeToken, setIncludeToken] = useState<boolean>(false);
  const [showElevation, setShowElevation] = useState<boolean>(false);

  const [enemySizeLabel, setEnemySizeLabel] = useState<TokenSizeName>("Medium");
  const [enemies, setEnemies] = useState<EnemyToken[]>([]);
  const nextEnemyId = useRef(1);

  const meta = AOE_TYPES.find((t) => t.id === aoeType) ?? AOE_TYPES[0];
  const tokenSize = TOKEN_SIZE_MAP[sizeLabel];
  const enemyPlaceSize = TOKEN_SIZE_MAP[enemySizeLabel];

  const config: AoEConfig = useMemo(
    () => ({
      type: aoeType,
      tokenSize,
      sizeFt,
      direction,
    }),
    [aoeType, tokenSize, sizeFt, direction],
  );

  const grid = useMemo(() => computeAoEGrid(config), [config]);

  const effectiveIncludeToken = aoeType === "emanation" && includeToken;
  const totalSquares =
    grid.affectedCount + (effectiveIncludeToken ? grid.tokenCount : 0);

  const enemySummaries = useMemo(
    () =>
      enemies.map((enemy) => ({
        enemy,
        distanceFt: enemyDistanceToOrigin(enemy, config),
        hit: isEnemyHitByAoE(enemy, config, effectiveIncludeToken),
      })),
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

  const handleAoETypeChange = (nextType: AoEType) => {
    const nextMeta = AOE_TYPES.find((t) => t.id === nextType) ?? AOE_TYPES[0];
    setAoeType(nextType);
    setSizeFt(nextMeta.defaultFt);
    // If switching from burst (no caster) to a caster-origin AoE, remove enemies overlapping the caster
    if (nextType !== "burst") {
      setEnemies((prev) => filterOverlappingCaster(prev, tokenSize));
    }
  };

  const handleSizeChange = (newSizeLabel: TokenSizeName) => {
    const newCasterSize = TOKEN_SIZE_MAP[newSizeLabel];
    setSizeLabel(newSizeLabel);
    if (aoeType !== "burst") {
      setEnemies((prev) => filterOverlappingCaster(prev, newCasterSize));
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

            {/* Caster Token Size (Emanation, Cone, Line) */}
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
          <div className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-crimson-600 dark:text-gold-400" />
                <h2 className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                  Enemy Tokens
                </h2>
              </div>
              {enemies.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearEnemies}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-stone-500 hover:text-crimson-600 hover:bg-stone-100 dark:text-zinc-400 dark:hover:text-crimson-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear all
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="enemy-size"
                className="block text-xs font-medium text-stone-600 dark:text-zinc-400"
              >
                Enemy Size to Drop (click map to place)
              </label>
              <select
                id="enemy-size"
                value={enemySizeLabel}
                onChange={(e) =>
                  setEnemySizeLabel(e.target.value as TokenSizeName)
                }
                className="w-full rounded-lg border border-stone-300 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 px-3 py-1.5 text-sm text-stone-900 dark:text-zinc-100 focus:border-crimson-600 dark:focus:border-gold-400 focus:outline-none"
              >
                {TOKEN_SIZES.map((size) => (
                  <option key={size.name} value={size.name}>
                    {size.name} — {size.feetLabel}
                  </option>
                ))}
              </select>
            </div>

            {enemySummaries.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                No enemies placed yet. Click any open square on the grid to drop
                an enemy token and check whether it&apos;s caught in the AoE.
              </p>
            ) : (
              <ul className="divide-y divide-stone-100 dark:divide-zinc-800 max-h-60 overflow-y-auto pr-1">
                {enemySummaries.map(({ enemy, distanceFt, hit }) => (
                  <li
                    key={enemy.id}
                    className="py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`inline-flex h-5 w-7 shrink-0 items-center justify-center rounded font-bold text-[11px] text-white ${
                          hit
                            ? "bg-crimson-600"
                            : "bg-slate-600 dark:bg-zinc-600"
                        }`}
                      >
                        {enemy.label}
                      </span>
                      <span className="truncate text-stone-700 dark:text-zinc-300">
                        {enemy.sizeName} · {distanceFt} ft
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Elevation stepper */}
                      <div
                        className="inline-flex items-center rounded-md border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950"
                        title="Enemy elevation above ground"
                      >
                        <button
                          type="button"
                          onClick={() => handleEnemyElevationChange(enemy.id, -5)}
                          disabled={enemy.elevationFt <= 0}
                          aria-label={`Decrease ${enemy.label} elevation`}
                          className="px-1 py-0.5 text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="px-1 min-w-[2.5rem] text-center tabular-nums font-medium text-[11px] text-stone-800 dark:text-zinc-200">
                          ↑{enemy.elevationFt} ft
                        </span>
                        <button
                          type="button"
                          onClick={() => handleEnemyElevationChange(enemy.id, 5)}
                          disabled={enemy.elevationFt >= 120}
                          aria-label={`Increase ${enemy.label} elevation`}
                          className="px-1 py-0.5 text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          hit
                            ? "bg-crimson-600/15 text-crimson-700 dark:bg-crimson-500/20 dark:text-crimson-300"
                            : "bg-stone-100 text-stone-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {hit ? "Hit" : "Safe"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveEnemy(enemy.id)}
                        aria-label={`Remove ${enemy.label}`}
                        className="p-0.5 rounded text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* SVG Grid */}
        <div className="lg:col-span-7">
          <AoEGrid
            config={config}
            sizeLabel={sizeLabel}
            includeToken={effectiveIncludeToken}
            showElevation={showElevation}
            grid={grid}
            enemies={enemies}
            enemyPlaceSize={enemyPlaceSize}
            onPlaceEnemy={handlePlaceEnemy}
            onRemoveEnemy={handleRemoveEnemy}
          />
        </div>
      </div>
    </div>
  );
}
