import { useEffect, useRef, useState, type RefObject } from "react";
import {
  canPlaceEnemy,
  enemyDistanceToOrigin,
  isEnemyHitByAoE,
  wallKey,
  type AoEConfig,
  type AoEGridResult,
  type EnemyToken,
  type GridCell,
  type TokenSizeName,
} from "../../lib/pf2e/grid";

export type MapInteractMode = "enemy" | "wall";

interface AoEGridProps {
  config: AoEConfig;
  sizeLabel: TokenSizeName;
  includeToken: boolean;
  showElevation: boolean;
  interactMode: MapInteractMode;
  grid: AoEGridResult;
  enemies: readonly EnemyToken[];
  walls: ReadonlySet<string>;
  enemyPlaceSize: number;
  onPlaceEnemy: (i: number, j: number) => void;
  onRemoveEnemy: (id: number) => void;
  onSetWall: (i: number, j: number, add: boolean) => void;
  svgRef?: RefObject<SVGSVGElement | null>;
}

const CELL_CLASS: Record<GridCell["kind"], string> = {
  empty: "fill-stone-100 dark:fill-zinc-900",
  token: "fill-blue-600 dark:fill-blue-500",
  affected: "fill-amber-500 dark:fill-amber-500/85",
  wall: "fill-stone-700 dark:fill-zinc-500",
  blocked: "fill-stone-300/70 dark:fill-zinc-800/90",
};

const AOE_TITLES: Record<AoEConfig["type"], string> = {
  emanation: "Emanation",
  burst: "Burst",
  cone: "Cone",
};

export function AoEGrid({
  config,
  sizeLabel,
  includeToken,
  showElevation,
  interactMode,
  grid,
  enemies,
  walls,
  enemyPlaceSize,
  onPlaceEnemy,
  onRemoveEnemy,
  onSetWall,
  svgRef,
}: AoEGridProps) {
  const [hovered, setHovered] = useState<GridCell | null>(null);
  const paintActionRef = useRef<"add" | "remove" | null>(null);

  useEffect(() => {
    const handleMouseUp = () => {
      paintActionRef.current = null;
    };
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const {
    cells,
    loX,
    hiX,
    loY,
    hiY,
    cols,
    rows,
    hasCaster,
    tokenCount,
    affectedCount,
    originIntersection,
  } = grid;

  const findEnemyAt = (i: number, j: number): EnemyToken | undefined =>
    enemies.find(
      (e) => i >= e.i && i < e.i + e.size && j >= e.j && j < e.j + e.size,
    );

  const hoveredEnemy = hovered ? findEnemyAt(hovered.i, hovered.j) : undefined;

  const canPlaceAtHovered =
    interactMode === "enemy" &&
    hovered !== null &&
    !hoveredEnemy &&
    canPlaceEnemy(
      hovered.i,
      hovered.j,
      enemyPlaceSize,
      hasCaster,
      config.tokenSize,
      enemies,
      loX,
      hiX,
      loY,
      hiY,
      walls,
    );

  const canPaintWallAt = (cell: GridCell) =>
    cell.kind !== "token" && !findEnemyAt(cell.i, cell.j);

  const handleCellMouseDown = (cell: GridCell) => {
    if (interactMode === "wall") {
      if (!canPaintWallAt(cell)) return;
      const shouldAdd = !walls.has(wallKey(cell.i, cell.j));
      paintActionRef.current = shouldAdd ? "add" : "remove";
      onSetWall(cell.i, cell.j, shouldAdd);
      return;
    }

    const existing = findEnemyAt(cell.i, cell.j);
    if (existing) {
      onRemoveEnemy(existing.id);
      return;
    }
    if (
      canPlaceEnemy(
        cell.i,
        cell.j,
        enemyPlaceSize,
        hasCaster,
        config.tokenSize,
        enemies,
        loX,
        hiX,
        loY,
        hiY,
        walls,
      )
    ) {
      onPlaceEnemy(cell.i, cell.j);
    }
  };

  const handleCellMouseEnter = (cell: GridCell) => {
    setHovered(cell);
    if (
      interactMode === "wall" &&
      paintActionRef.current !== null &&
      canPaintWallAt(cell)
    ) {
      onSetWall(cell.i, cell.j, paintActionRef.current === "add");
    }
  };

  const titlePrefix =
    config.type === "burst"
      ? `${config.sizeFt} ft Burst`
      : config.type === "emanation"
        ? `${sizeLabel} (${config.tokenSize}×${config.tokenSize}) — ${config.sizeFt} ft Emanation`
        : `${sizeLabel} (${config.tokenSize}×${config.tokenSize}) — ${config.sizeFt} ft ${AOE_TITLES[config.type]} (${config.direction})`;

  const originLabel = config.type === "burst" ? "origin" : "caster";

  return (
    <div className="flex flex-col rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-4 sm:p-5 shadow-xs">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
          {titlePrefix}
        </h2>
        <span className="text-xs text-stone-500 dark:text-zinc-400">
          {interactMode === "wall"
            ? "Click & drag to paint/erase walls"
            : "Click map to drop/remove enemy"}{" "}
          · 1 sq = 5 ft
        </span>
      </div>

      <div className="relative mx-auto w-full max-w-[560px] aspect-square overflow-hidden rounded-lg border border-stone-300 dark:border-zinc-700 bg-stone-200 dark:bg-zinc-800">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${cols} ${rows}`}
          className="h-full w-full block select-none cursor-crosshair"
          role="img"
          aria-label={`${titlePrefix} affecting ${affectedCount} squares`}
          onMouseLeave={() => setHovered(null)}
        >
          {/* Base grid squares */}
          {cells.map((cell) => {
            const x = cell.i - loX;
            const y = hiY - 1 - cell.j;
            const isHovered =
              hovered !== null && hovered.i === cell.i && hovered.j === cell.j;
            return (
              <rect
                key={`${cell.i},${cell.j}`}
                x={x}
                y={y}
                width={1}
                height={1}
                vectorEffect="non-scaling-stroke"
                strokeWidth={isHovered ? 1.5 : 0.75}
                className={`${CELL_CLASS[cell.kind]} ${
                  isHovered
                    ? "stroke-stone-950 dark:stroke-white"
                    : "stroke-stone-300/90 dark:stroke-zinc-700/80"
                }`}
                onMouseEnter={() => handleCellMouseEnter(cell)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleCellMouseDown(cell);
                }}
              />
            );
          })}

          {/* Max elevation labels per square */}
          {showElevation &&
            cells.map((cell) => {
              if (cell.maxElevationFt === null) return null;
              const x = cell.i - loX;
              const y = hiY - 1 - cell.j;
              const label = `${cell.maxElevationFt}`;
              const fontSize = label.length >= 3 ? 0.3 : 0.36;
              return (
                <text
                  key={`elev-${cell.i},${cell.j}`}
                  x={x + 0.5}
                  y={y + 0.5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={fontSize}
                  fontWeight={700}
                  className={
                    cell.kind === "token"
                      ? "fill-white/95 pointer-events-none select-none"
                      : "fill-stone-950/90 dark:fill-zinc-950 pointer-events-none select-none"
                  }
                >
                  {label}
                </text>
              );
            })}

          {/* Placement ghost preview (enemy mode) */}
          {interactMode === "enemy" && hovered && !hoveredEnemy && (
            <rect
              x={hovered.i - loX}
              y={hiY - hovered.j - enemyPlaceSize}
              width={enemyPlaceSize}
              height={enemyPlaceSize}
              rx={0.18}
              ry={0.18}
              vectorEffect="non-scaling-stroke"
              strokeWidth={2}
              strokeDasharray="4 3"
              className={
                canPlaceAtHovered
                  ? "fill-crimson-600/25 stroke-crimson-600 dark:fill-crimson-500/30 dark:stroke-crimson-400 pointer-events-none"
                  : "fill-zinc-500/20 stroke-zinc-500/70 pointer-events-none"
              }
            />
          )}

          {/* Placed enemy tokens */}
          {enemies.map((enemy) => {
            const x = enemy.i - loX;
            const y = hiY - enemy.j - enemy.size;
            if (
              x + enemy.size <= 0 ||
              x >= cols ||
              y + enemy.size <= 0 ||
              y >= rows
            ) {
              return null;
            }
            const hit = isEnemyHitByAoE(enemy, config, includeToken);
            const pad = 0.1;
            const hasElev = enemy.elevationFt > 0;
            const fontSize = Math.min(
              enemy.size * (hasElev ? 0.34 : 0.42),
              hasElev ? 0.44 : 0.55,
            );
            const elevFontSize = Math.min(enemy.size * 0.24, 0.3);

            return (
              <g
                key={enemy.id}
                className={
                  interactMode === "enemy"
                    ? "cursor-pointer"
                    : "pointer-events-none"
                }
                onMouseDown={(e) => {
                  if (interactMode !== "enemy") return;
                  e.stopPropagation();
                  onRemoveEnemy(enemy.id);
                }}
                onMouseEnter={() =>
                  setHovered({
                    i: enemy.i,
                    j: enemy.j,
                    kind: hit ? "affected" : "empty",
                    distanceFt: enemyDistanceToOrigin(enemy, config),
                    maxElevationFt: null,
                  })
                }
              >
                <rect
                  x={x + pad}
                  y={y + pad}
                  width={enemy.size - pad * 2}
                  height={enemy.size - pad * 2}
                  rx={enemy.size * 0.25}
                  ry={enemy.size * 0.25}
                  vectorEffect="non-scaling-stroke"
                  strokeWidth={2.2}
                  className={
                    hit
                      ? "fill-crimson-600 stroke-white dark:fill-crimson-600 dark:stroke-amber-100"
                      : "fill-slate-600 stroke-slate-200 dark:fill-zinc-600 dark:stroke-zinc-300"
                  }
                />
                <text
                  x={x + enemy.size / 2}
                  y={y + enemy.size * (hasElev ? 0.38 : 0.5)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={fontSize}
                  fontWeight={700}
                  className="fill-white pointer-events-none select-none"
                >
                  {enemy.label}
                </text>
                {hasElev && (
                  <text
                    x={x + enemy.size / 2}
                    y={y + enemy.size * 0.72}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={elevFontSize}
                    fontWeight={600}
                    className="fill-amber-200 pointer-events-none select-none"
                  >
                    ↑{enemy.elevationFt}&apos;
                  </text>
                )}
              </g>
            );
          })}

          {/* Origin grid intersection marker (Burst & Cone) */}
          {originIntersection && (
            <g className="pointer-events-none">
              <circle
                cx={originIntersection.x - loX}
                cy={hiY - originIntersection.y}
                r={Math.max(0.22, cols * 0.014)}
                vectorEffect="non-scaling-stroke"
                strokeWidth={2}
                className="fill-crimson-600 stroke-white dark:fill-gold-400 dark:stroke-zinc-950"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Hover readout */}
      <div className="mt-3 min-h-[1.5rem] flex items-center justify-center text-xs text-stone-600 dark:text-zinc-400">
        {hoveredEnemy ? (
          <span>
            <strong className="font-semibold text-stone-900 dark:text-zinc-100">
              {hoveredEnemy.label} ({hoveredEnemy.sizeName}
              {hoveredEnemy.elevationFt > 0
                ? `, ↑${hoveredEnemy.elevationFt} ft`
                : ""}
              )
            </strong>{" "}
            · {enemyDistanceToOrigin(hoveredEnemy, config)} ft from {originLabel}{" "}
            ·{" "}
            {isEnemyHitByAoE(hoveredEnemy, config, includeToken)
              ? "Hit by AoE"
              : "Safe (outside / blocked)"}{" "}
            {interactMode === "enemy" ? "· Click to remove" : ""}
          </span>
        ) : hovered ? (
          <span>
            Square ({hovered.i}, {hovered.j}) ·{" "}
            <strong className="font-semibold text-stone-900 dark:text-zinc-100">
              {hovered.kind === "token"
                ? "Caster space (0 ft)"
                : hovered.kind === "wall"
                  ? "Wall (blocks Line of Effect)"
                  : `${hovered.distanceFt} ft from ${originLabel}`}
            </strong>
            {hovered.kind === "blocked" && " · Blocked by wall"}
            {showElevation && hovered.maxElevationFt !== null && (
              <>
                {" "}
                · Max elevation:{" "}
                <strong className="font-semibold text-stone-900 dark:text-zinc-100">
                  {hovered.maxElevationFt} ft
                </strong>
              </>
            )}
          </span>
        ) : (
          <span>
            {interactMode === "wall"
              ? "Click and drag on open squares to paint or erase Line-of-Effect walls"
              : "Hover to inspect distance · Click any open square to drop an enemy token"}
          </span>
        )}
      </div>

      {/* External legend */}
      <div className="mt-3 pt-3 border-t border-stone-200 dark:border-zinc-800 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-stone-700 dark:text-zinc-300">
        {hasCaster && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded-xs bg-blue-600 dark:bg-blue-500 border border-stone-400/50 dark:border-zinc-600" />
            Caster ({sizeLabel}, {tokenCount} sq)
          </span>
        )}
        {originIntersection && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-crimson-600 dark:bg-gold-400 ring-2 ring-stone-300 dark:ring-zinc-700" />
            Origin intersection
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-xs bg-amber-500 border border-stone-400/50 dark:border-zinc-600" />
          {AOE_TITLES[config.type]} ({affectedCount} sq)
        </span>
        {walls.size > 0 && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded-xs bg-stone-700 dark:bg-zinc-500 border border-stone-400/50 dark:border-zinc-600" />
              Wall ({walls.size})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded-xs bg-stone-300/80 dark:bg-zinc-800 border border-stone-400/50 dark:border-zinc-600" />
              Blocked LoE
            </span>
          </>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-full bg-crimson-600 border border-stone-400/60 dark:border-amber-200/70" />
          Enemy (Hit)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-full bg-slate-600 dark:bg-zinc-600 border border-stone-400/60 dark:border-zinc-400/70" />
          Enemy (Safe)
        </span>
      </div>
    </div>
  );
}
