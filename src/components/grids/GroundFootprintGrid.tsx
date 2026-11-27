import type { VerticalAoEResult } from "../../lib/pf2e/vertical";

interface GroundFootprintGridProps {
  title: string;
  result: VerticalAoEResult;
}

export function GroundFootprintGrid({
  title,
  result,
}: GroundFootprintGridProps) {
  const { groundCells, groundLo, groundHi, groundOrigin, groundSquaresHit } =
    result;
  const gridSize = groundHi - groundLo;

  return (
    <div className="flex flex-col rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-4 sm:p-5 shadow-xs">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
          {title}
        </h2>
        <span className="text-xs text-stone-500 dark:text-zinc-400">
          Top-down ground view · {groundSquaresHit} sq
        </span>
      </div>

      <div className="relative mx-auto w-full max-w-[460px] aspect-square overflow-hidden rounded-lg border border-stone-300 dark:border-zinc-700 bg-stone-200 dark:bg-zinc-800">
        <svg
          viewBox={`0 0 ${gridSize} ${gridSize}`}
          className="h-full w-full block select-none"
          role="img"
          aria-label={`${title} affecting ${groundSquaresHit} ground squares`}
        >
          {groundCells.map((cell) => {
            const x = cell.i - groundLo;
            const y = groundHi - 1 - cell.j;
            return (
              <rect
                key={`${cell.i},${cell.j}`}
                x={x}
                y={y}
                width={1}
                height={1}
                vectorEffect="non-scaling-stroke"
                strokeWidth={0.75}
                className={`${
                  cell.hit
                    ? "fill-crimson-600/90 dark:fill-crimson-500/90"
                    : "fill-stone-100 dark:fill-zinc-900"
                } stroke-stone-300/90 dark:stroke-zinc-700/80`}
              />
            );
          })}

          {/* Projected overhead origin */}
          <circle
            cx={groundOrigin.x - groundLo}
            cy={groundHi - groundOrigin.y}
            r={Math.max(0.2, gridSize * 0.015)}
            vectorEffect="non-scaling-stroke"
            strokeWidth={2}
            className="fill-blue-600 stroke-white dark:fill-gold-400 dark:stroke-zinc-950"
          />
        </svg>
      </div>

      <div className="mt-3 pt-3 border-t border-stone-200 dark:border-zinc-800 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-stone-700 dark:text-zinc-300">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-xs bg-crimson-600 dark:bg-crimson-500 border border-stone-400/50 dark:border-zinc-600" />
          Affected ground ({groundSquaresHit} sq)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-blue-600 dark:bg-gold-400 ring-2 ring-stone-300 dark:ring-zinc-700" />
          Overhead origin
        </span>
      </div>
    </div>
  );
}
