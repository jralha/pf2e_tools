import type { RefObject } from "react";
import type { SideCellKind, VerticalAoEResult } from "../../lib/pf2e/vertical";

interface SideViewGridProps {
  title: string;
  originLabel: string;
  result: VerticalAoEResult;
  svgRef?: RefObject<SVGSVGElement | null>;
}

const SIDE_CELL_CLASS: Record<SideCellKind, string> = {
  empty: "fill-stone-100 dark:fill-zinc-900",
  air: "fill-amber-400/75 dark:fill-amber-500/55",
  "ground-hit": "fill-crimson-600 dark:fill-crimson-500",
};

export function SideViewGrid({
  title,
  originLabel,
  result,
  svgRef,
}: SideViewGridProps) {
  const { sideCells, sideLoX, sideHiX, sideMaxZ, sideOrigin } = result;
  const cols = sideHiX - sideLoX;
  const rows = sideMaxZ;

  // Extra margin in grid units for left elevation labels and bottom ground band
  const leftMargin = Math.max(1.8, cols * 0.14);
  const groundBand = Math.max(0.9, rows * 0.08);
  const totalW = cols + leftMargin;
  const totalH = rows + groundBand;

  const originSvgX = leftMargin + (sideOrigin.x - sideLoX);
  const originSvgY = rows - sideOrigin.z;
  const groundLineY = rows;

  // Pick a clean elevation tick step (every 5, 10, or 20 ft depending on height)
  const tickStepSq = rows > 18 ? 4 : rows > 10 ? 2 : 1;
  const ticks: number[] = [];
  for (let z = 0; z <= rows; z += tickStepSq) {
    ticks.push(z);
  }

  const labelFontSize = Math.max(0.32, Math.min(0.55, rows * 0.045));

  return (
    <div className="flex flex-col rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-4 sm:p-5 shadow-xs">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
          {title}
        </h2>
        <span className="text-xs text-stone-500 dark:text-zinc-400">
          Side view · 1 sq = 5 ft
        </span>
      </div>

      <div className="relative mx-auto w-full max-w-[560px] overflow-hidden rounded-lg border border-stone-300 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${totalW} ${totalH}`}
          className="h-auto w-full block select-none"
          role="img"
          aria-label={title}
        >
          {/* Elevation axis ticks */}
          {ticks.map((z) => {
            const y = rows - z;
            return (
              <text
                key={`tick-${z}`}
                x={leftMargin - 0.25}
                y={y}
                textAnchor="end"
                dominantBaseline="central"
                fontSize={labelFontSize}
                className="fill-stone-500 dark:fill-zinc-400"
              >
                {z * 5} ft
              </text>
            );
          })}

          {/* Grid cubes */}
          {sideCells.map((cell) => {
            const svgX = leftMargin + (cell.x - sideLoX);
            const svgY = rows - 1 - cell.z;
            return (
              <rect
                key={`${cell.x},${cell.z}`}
                x={svgX}
                y={svgY}
                width={1}
                height={1}
                vectorEffect="non-scaling-stroke"
                strokeWidth={0.75}
                className={`${SIDE_CELL_CLASS[cell.kind]} stroke-stone-300/80 dark:stroke-zinc-800`}
              />
            );
          })}

          {/* Earth / ground band below z = 0 */}
          <rect
            x={leftMargin}
            y={groundLineY}
            width={cols}
            height={groundBand}
            className="fill-stone-300/80 dark:fill-zinc-800/90"
          />
          <line
            x1={leftMargin}
            y1={groundLineY}
            x2={totalW}
            y2={groundLineY}
            vectorEffect="non-scaling-stroke"
            strokeWidth={2.5}
            className="stroke-stone-700 dark:stroke-zinc-400"
          />
          <text
            x={leftMargin + cols / 2}
            y={groundLineY + groundBand / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={labelFontSize}
            fontWeight={600}
            className="fill-stone-700 dark:fill-zinc-300"
          >
            Ground Level (0 ft)
          </text>

          {/* Dashed height guide from origin down to ground */}
          {sideOrigin.z > 0 && (
            <line
              x1={originSvgX}
              y1={originSvgY}
              x2={originSvgX}
              y2={groundLineY}
              vectorEffect="non-scaling-stroke"
              strokeWidth={1.75}
              strokeDasharray="4 3"
              className="stroke-stone-800/80 dark:stroke-gold-400/90"
            />
          )}

          {/* Origin marker */}
          <circle
            cx={originSvgX}
            cy={originSvgY}
            r={Math.max(0.22, Math.min(0.4, cols * 0.018))}
            vectorEffect="non-scaling-stroke"
            strokeWidth={2}
            className="fill-blue-600 stroke-white dark:fill-gold-400 dark:stroke-zinc-950"
          />
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-stone-200 dark:border-zinc-800 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-stone-700 dark:text-zinc-300">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-blue-600 dark:bg-gold-400 ring-2 ring-stone-300 dark:ring-zinc-700" />
          {originLabel} ({sideOrigin.z * 5} ft)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-xs bg-amber-400/80 dark:bg-amber-500/60 border border-stone-400/50 dark:border-zinc-600" />
          Airborne AoE
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-xs bg-crimson-600 dark:bg-crimson-500 border border-stone-400/50 dark:border-zinc-600" />
          Ground intercept (0–5 ft)
        </span>
      </div>
    </div>
  );
}
