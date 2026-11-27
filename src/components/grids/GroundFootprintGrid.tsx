import { useState, type RefObject } from "react";
import { canPlaceEnemy, type EnemyToken } from "../../lib/pf2e/grid";
import type { GroundCell, VerticalAoEResult } from "../../lib/pf2e/vertical";

interface GroundFootprintGridProps {
  title: string;
  result: VerticalAoEResult;
  enemies: readonly EnemyToken[];
  enemyPlaceSize: number;
  isEnemyHit: (enemy: EnemyToken) => boolean;
  onPlaceEnemy: (i: number, j: number) => void;
  onRemoveEnemy: (id: number) => void;
  svgRef?: RefObject<SVGSVGElement | null>;
}

export function GroundFootprintGrid({
  title,
  result,
  enemies,
  enemyPlaceSize,
  isEnemyHit,
  onPlaceEnemy,
  onRemoveEnemy,
  svgRef,
}: GroundFootprintGridProps) {
  const [hovered, setHovered] = useState<GroundCell | null>(null);
  const { groundCells, groundLo, groundHi, groundOrigin, groundSquaresHit } =
    result;
  const gridSize = groundHi - groundLo;

  const findEnemyAt = (i: number, j: number): EnemyToken | undefined =>
    enemies.find(
      (e) => i >= e.i && i < e.i + e.size && j >= e.j && j < e.j + e.size,
    );

  const hoveredEnemy = hovered ? findEnemyAt(hovered.i, hovered.j) : undefined;

  const canPlaceAtHovered =
    hovered !== null &&
    !hoveredEnemy &&
    canPlaceEnemy(
      hovered.i,
      hovered.j,
      enemyPlaceSize,
      false,
      0,
      enemies,
      groundLo,
      groundHi,
      groundLo,
      groundHi,
    );

  const handleCellClick = (cell: GroundCell) => {
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
        false,
        0,
        enemies,
        groundLo,
        groundHi,
        groundLo,
        groundHi,
      )
    ) {
      onPlaceEnemy(cell.i, cell.j);
    }
  };

  return (
    <div className="flex flex-col rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-4 sm:p-5 shadow-xs">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
          {title}
        </h2>
        <span className="text-xs text-stone-500 dark:text-zinc-400">
          Click to drop/remove enemy · {groundSquaresHit} ground sq
        </span>
      </div>

      <div className="relative mx-auto w-full max-w-[460px] aspect-square overflow-hidden rounded-lg border border-stone-300 dark:border-zinc-700 bg-stone-200 dark:bg-zinc-800">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${gridSize} ${gridSize}`}
          className="h-full w-full block select-none cursor-crosshair"
          role="img"
          aria-label={`${title} affecting ${groundSquaresHit} ground squares`}
          onMouseLeave={() => setHovered(null)}
        >
          {groundCells.map((cell) => {
            const x = cell.i - groundLo;
            const y = groundHi - 1 - cell.j;
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
                className={`${
                  cell.hit
                    ? "fill-amber-500 dark:fill-amber-500/85"
                    : "fill-stone-100 dark:fill-zinc-900"
                } ${
                  isHovered
                    ? "stroke-stone-950 dark:stroke-white"
                    : "stroke-stone-300/90 dark:stroke-zinc-700/80"
                }`}
                onMouseEnter={() => setHovered(cell)}
                onClick={() => handleCellClick(cell)}
              />
            );
          })}

          {/* Placement ghost preview */}
          {hovered && !hoveredEnemy && (
            <rect
              x={hovered.i - groundLo}
              y={groundHi - hovered.j - enemyPlaceSize}
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
            const x = enemy.i - groundLo;
            const y = groundHi - enemy.j - enemy.size;
            if (
              x + enemy.size <= 0 ||
              x >= gridSize ||
              y + enemy.size <= 0 ||
              y >= gridSize
            ) {
              return null;
            }
            const hit = isEnemyHit(enemy);
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
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveEnemy(enemy.id);
                }}
                onMouseEnter={() =>
                  setHovered({ i: enemy.i, j: enemy.j, hit })
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

          {/* Projected overhead origin */}
          <circle
            cx={groundOrigin.x - groundLo}
            cy={groundHi - groundOrigin.y}
            r={Math.max(0.2, gridSize * 0.015)}
            vectorEffect="non-scaling-stroke"
            strokeWidth={2}
            className="fill-blue-600 stroke-white dark:fill-gold-400 dark:stroke-zinc-950 pointer-events-none"
          />
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
            · {isEnemyHit(hoveredEnemy) ? "Hit in 3D" : "Safe"} · Click to
            remove
          </span>
        ) : hovered ? (
          <span>
            Square ({hovered.i}, {hovered.j}) ·{" "}
            {hovered.hit ? "Hit at ground level" : "Outside ground footprint"} ·{" "}
            {canPlaceAtHovered ? "Click to drop enemy" : "Cannot place here"}
          </span>
        ) : (
          <span>
            Click any open square to drop an enemy (adjust elevation in the
            sidebar)
          </span>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-stone-200 dark:border-zinc-800 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-stone-700 dark:text-zinc-300">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-xs bg-amber-500 border border-stone-400/50 dark:border-zinc-600" />
          Affected ground ({groundSquaresHit} sq)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-blue-600 dark:bg-gold-400 ring-2 ring-stone-300 dark:ring-zinc-700" />
          Overhead origin
        </span>
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
