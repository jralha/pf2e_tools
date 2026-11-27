import { useMemo, useState, type RefObject } from "react";
import type {
  DistributionSummary,
  HistogramBin,
  PMF,
} from "../../lib/pf2e/damage";

export interface HistogramSeries {
  key: string;
  label: string;
  fillClass: string;
  swatchClass: string;
  pmf: PMF;
}

interface Segment {
  key: string;
  label: string;
  fillClass: string;
  probability: number;
}

interface DisplayBin {
  label: string;
  rangeMin: number;
  rangeMax: number;
  probability: number;
  cumulativeAtLeast: number;
  isZero: boolean;
  segments: Segment[];
}

interface DamageHistogramProps {
  title: string;
  summary: DistributionSummary;
  series?: readonly HistogramSeries[];
  hideZero?: boolean;
  onToggleHideZero?: (hide: boolean) => void;
  showHideZeroOption?: boolean;
  svgRef?: RefObject<SVGSVGElement | null>;
}

const MAX_BARS = 55;

function sumSeriesRange(
  pmf: PMF,
  start: number,
  end: number,
  cumulative: boolean,
): number {
  let total = 0;
  if (cumulative) {
    for (const [v, p] of pmf) {
      if (v >= start) total += p;
    }
    return total;
  }
  for (let v = start; v <= end; v++) {
    const p = pmf.get(v);
    if (p) total += p;
  }
  return total;
}

function buildSegments(
  start: number,
  end: number,
  cumulative: boolean,
  series?: readonly HistogramSeries[],
): Segment[] {
  if (!series || series.length === 0) return [];
  const segs: Segment[] = [];
  for (const s of series) {
    const p = sumSeriesRange(s.pmf, start, end, cumulative);
    if (p > 1e-12) {
      segs.push({
        key: s.key,
        label: s.label,
        fillClass: s.fillClass,
        probability: p,
      });
    }
  }
  return segs;
}

function cumulativeFromBins(bins: readonly HistogramBin[], threshold: number): number {
  let total = 0;
  for (const b of bins) {
    if (b.value >= threshold) total += b.probability;
  }
  return Math.min(1, total);
}

function buildDisplayBins(
  bins: readonly HistogramBin[],
  hideZero: boolean,
  cumulative: boolean,
  series?: readonly HistogramSeries[],
): DisplayBin[] {
  const filtered = hideZero ? bins.filter((b) => b.value > 0) : bins;
  if (filtered.length === 0) return [];

  const minVal = filtered[0].value;
  const maxVal = filtered[filtered.length - 1].value;
  const span = maxVal - minVal + 1;

  if (span <= MAX_BARS) {
    const byVal = new Map(filtered.map((b) => [b.value, b]));
    const dense: DisplayBin[] = new Array(span);
    let tail = 0;
    for (let v = maxVal; v >= minVal; v--) {
      const hit = byVal.get(v);
      const prob = hit?.probability ?? 0;
      tail = Math.min(1, tail + prob);
      dense[v - minVal] = {
        label: String(v),
        rangeMin: v,
        rangeMax: v,
        probability: prob,
        cumulativeAtLeast: tail,
        isZero: v === 0,
        segments:
          cumulative || prob > 0
            ? buildSegments(v, v, cumulative, series)
            : [],
      };
    }
    return dense;
  }

  const bucketWidth = Math.ceil(span / MAX_BARS);
  const grouped: DisplayBin[] = [];
  for (let start = minVal; start <= maxVal; start += bucketWidth) {
    const end = Math.min(maxVal, start + bucketWidth - 1);
    let prob = 0;
    for (const b of filtered) {
      if (b.value >= start && b.value <= end) {
        prob += b.probability;
      }
    }
    grouped.push({
      label: start === end ? String(start) : `${start}–${end}`,
      rangeMin: start,
      rangeMax: end,
      probability: prob,
      cumulativeAtLeast: cumulativeFromBins(bins, start),
      isZero: start === 0 && end === 0,
      segments: buildSegments(start, end, cumulative, series),
    });
  }
  return grouped;
}

export function DamageHistogram({
  title,
  summary,
  series,
  hideZero = false,
  onToggleHideZero,
  showHideZeroOption = false,
  svgRef,
}: DamageHistogramProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [showColors, setShowColors] = useState<boolean>(true);
  const [cumulative, setCumulative] = useState<boolean>(false);

  const hasSeries = Boolean(series && series.length > 0);
  const activeSeries = hasSeries && showColors ? series : undefined;

  const displayBins = useMemo(
    () => buildDisplayBins(summary.bins, hideZero, cumulative, activeSeries),
    [summary.bins, hideZero, cumulative, activeSeries],
  );

  const width = 640;
  const height = 320;
  const padLeft = 48;
  const padRight = 20;
  const padTop = 24;
  const padBottom = 42;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const getBarValue = (bin: DisplayBin) =>
    cumulative ? bin.cumulativeAtLeast : bin.probability;

  const maxProb = Math.max(0.01, ...displayBins.map(getBarValue));
  const yMax = cumulative ? 1 : Math.min(1, maxProb * 1.12);

  const barStep = displayBins.length > 0 ? chartW / displayBins.length : chartW;
  const barW = Math.max(2, barStep * 0.78);
  const barGap = (barStep - barW) / 2;

  let meanX: number | null = null;
  if (displayBins.length > 0) {
    const firstMin = displayBins[0].rangeMin;
    const lastMax = displayBins[displayBins.length - 1].rangeMax;
    if (summary.mean >= firstMin && summary.mean <= lastMax) {
      const denom = Math.max(1, lastMax - firstMin);
      const frac = (summary.mean - firstMin) / denom;
      meanX = padLeft + barStep / 2 + frac * (chartW - barStep);
    }
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * yMax);
  const xLabelStride = Math.max(1, Math.ceil(displayBins.length / 10));
  const hoveredBin = hoveredIdx !== null ? displayBins[hoveredIdx] : null;

  return (
    <div className="flex flex-col rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-4 sm:p-5 shadow-xs">
      <div className="mb-3 flex flex-col gap-2">
        <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
          {cumulative ? `${title} — At Least X` : title}
        </h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <label className="inline-flex items-center gap-1.5 text-xs text-stone-600 dark:text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={cumulative}
              onChange={(e) => setCumulative(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-stone-300 dark:border-zinc-700 accent-crimson-600 dark:accent-gold-400 cursor-pointer"
            />
            Cumulative (≥ X)
          </label>
          {hasSeries && (
            <label className="inline-flex items-center gap-1.5 text-xs text-stone-600 dark:text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showColors}
                onChange={(e) => setShowColors(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-stone-300 dark:border-zinc-700 accent-crimson-600 dark:accent-gold-400 cursor-pointer"
              />
              Color by outcome
            </label>
          )}
          {showHideZeroOption && onToggleHideZero && (
            <label className="inline-flex items-center gap-1.5 text-xs text-stone-600 dark:text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={hideZero}
                onChange={(e) => onToggleHideZero(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-stone-300 dark:border-zinc-700 accent-crimson-600 dark:accent-gold-400 cursor-pointer"
              />
              Hide 0-damage bar
            </label>
          )}
        </div>
      </div>

      <div className="w-full overflow-hidden rounded-lg border border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950 p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full block select-none"
          role="img"
          aria-label={`Damage probability histogram with mean ${summary.mean.toFixed(2)}`}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* Horizontal gridlines & Y ticks */}
          {yTicks.map((prob, idx) => {
            const y = padTop + chartH - (prob / yMax) * chartH;
            return (
              <g key={`y-${idx}`}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  strokeWidth={1}
                  className="stroke-stone-200 dark:stroke-zinc-800"
                />
                <text
                  x={padLeft - 8}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="central"
                  fontSize={11}
                  className="fill-stone-500 dark:fill-zinc-400"
                >
                  {(prob * 100).toFixed(prob * 100 >= 10 ? 0 : 1)}%
                </text>
              </g>
            );
          })}

          {/* Bars (stacked by degree when series is provided) */}
          {displayBins.map((bin, idx) => {
            const x = padLeft + idx * barStep + barGap;
            const isHovered = hoveredIdx === idx;
            const hasSegments = bin.segments.length > 0;

            return (
              <g
                key={`${bin.label}-${idx}`}
                onMouseEnter={() => setHoveredIdx(idx)}
              >
                <rect
                  x={padLeft + idx * barStep}
                  y={padTop}
                  width={barStep}
                  height={chartH}
                  className="fill-transparent cursor-pointer"
                />
                {hasSegments ? (
                  (() => {
                    let currentBottom = padTop + chartH;
                    return bin.segments.map((seg, sIdx) => {
                      const segH = (seg.probability / yMax) * chartH;
                      const y = currentBottom - segH;
                      currentBottom = y;
                      const isTop = sIdx === bin.segments.length - 1;
                      return (
                        <rect
                          key={seg.key}
                          x={x}
                          y={y}
                          width={barW}
                          height={segH}
                          rx={isTop ? Math.min(2.5, barW / 3) : 0}
                          className={`${seg.fillClass} ${
                            isHovered ? "opacity-100 stroke-stone-950 dark:stroke-white" : "opacity-90"
                          }`}
                          strokeWidth={isHovered ? 1.2 : 0}
                        />
                      );
                    });
                  })()
                ) : getBarValue(bin) > 0 ? (
                  <rect
                    x={x}
                    y={padTop + chartH - (getBarValue(bin) / yMax) * chartH}
                    width={barW}
                    height={(getBarValue(bin) / yMax) * chartH}
                    rx={Math.min(3, barW / 3)}
                    className={
                      bin.isZero && !cumulative
                        ? isHovered
                          ? "fill-slate-500 dark:fill-zinc-400"
                          : "fill-slate-400/80 dark:fill-zinc-600"
                        : isHovered
                          ? "fill-crimson-600 dark:fill-gold-400"
                          : "fill-amber-500/90 dark:fill-amber-500/80"
                    }
                  />
                ) : null}
              </g>
            );
          })}

          {/* X-axis baseline & labels */}
          <line
            x1={padLeft}
            y1={padTop + chartH}
            x2={width - padRight}
            y2={padTop + chartH}
            strokeWidth={1.5}
            className="stroke-stone-400 dark:stroke-zinc-600"
          />
          {displayBins.map((bin, idx) => {
            if (idx % xLabelStride !== 0 && idx !== displayBins.length - 1) {
              return null;
            }
            const cx = padLeft + idx * barStep + barStep / 2;
            return (
              <text
                key={`x-${idx}`}
                x={cx}
                y={padTop + chartH + 16}
                textAnchor="middle"
                fontSize={11}
                className="fill-stone-600 dark:fill-zinc-400"
              >
                {bin.label}
              </text>
            );
          })}

          {/* X-axis title */}
          <text
            x={padLeft + chartW / 2}
            y={height - 6}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            className="fill-stone-500 dark:fill-zinc-400"
          >
            {cumulative ? "Minimum Damage (≥ X)" : "Damage"}
          </text>

          {/* Mean vertical dashed line */}
          {meanX !== null && (
            <g className="pointer-events-none">
              <line
                x1={meanX}
                y1={padTop}
                x2={meanX}
                y2={padTop + chartH}
                strokeWidth={2}
                strokeDasharray="5 4"
                className="stroke-crimson-600 dark:stroke-gold-400"
              />
              <text
                x={Math.min(width - padRight - 4, Math.max(padLeft + 4, meanX))}
                y={padTop - 8}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                className="fill-crimson-700 dark:fill-gold-400"
              >
                Avg {summary.mean.toFixed(1)}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Hover readout */}
      <div className="mt-3 min-h-[1.5rem] flex flex-wrap items-center justify-center gap-x-2 text-xs text-stone-600 dark:text-zinc-400">
        {hoveredBin ? (
          cumulative ? (
            <span>
              At least{" "}
              <strong className="font-semibold text-stone-900 dark:text-zinc-100">
                {hoveredBin.rangeMin}
              </strong>{" "}
              damage:{" "}
              <strong className="font-semibold text-stone-900 dark:text-zinc-100">
                {(hoveredBin.cumulativeAtLeast * 100).toFixed(2)}%
              </strong>
              {hoveredBin.segments.length > 0 && (
                <span>
                  {" "}
                  (
                  {hoveredBin.segments
                    .map(
                      (s) => `${s.label} ${(s.probability * 100).toFixed(1)}%`,
                    )
                    .join(", ")}
                  )
                </span>
              )}{" "}
              · Exact ({hoveredBin.label}):{" "}
              <strong className="font-semibold text-stone-900 dark:text-zinc-100">
                {(hoveredBin.probability * 100).toFixed(2)}%
              </strong>
            </span>
          ) : (
            <span>
              Damage{" "}
              <strong className="font-semibold text-stone-900 dark:text-zinc-100">
                {hoveredBin.label}
              </strong>{" "}
              · Chance:{" "}
              <strong className="font-semibold text-stone-900 dark:text-zinc-100">
                {(hoveredBin.probability * 100).toFixed(2)}%
              </strong>
              {hoveredBin.segments.length > 0 && (
                <span>
                  {" "}
                  (
                  {hoveredBin.segments
                    .map(
                      (s) => `${s.label} ${(s.probability * 100).toFixed(1)}%`,
                    )
                    .join(", ")}
                  )
                </span>
              )}{" "}
              · At least {hoveredBin.rangeMin}:{" "}
              <strong className="font-semibold text-stone-900 dark:text-zinc-100">
                {(hoveredBin.cumulativeAtLeast * 100).toFixed(2)}%
              </strong>
            </span>
          )
        ) : (
          <span>
            Hover any bar to inspect{" "}
            {cumulative
              ? "cumulative (≥ X) and exact probabilities"
              : "exact and cumulative probabilities"}
          </span>
        )}
      </div>

      {/* Degree-of-Success Color Legend */}
      {activeSeries && activeSeries.length > 0 && (
        <div className="mt-3 pt-3 border-t border-stone-200 dark:border-zinc-800 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-stone-700 dark:text-zinc-300">
          {activeSeries.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span
                className={`h-3 w-3 rounded-xs border border-stone-400/40 dark:border-zinc-600 ${s.swatchClass}`}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
