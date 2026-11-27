import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Target } from "lucide-react";
import { computeAirburst } from "../../lib/pf2e/vertical";
import { SideViewGrid } from "../../components/grids/SideViewGrid";
import { GroundFootprintGrid } from "../../components/grids/GroundFootprintGrid";

const RADIUS_PRESETS = [5, 10, 15, 20, 30, 60] as const;
const HEIGHT_PRESETS = [0, 5, 10, 15, 20, 30] as const;

export default function AirburstTool() {
  const [radiusFt, setRadiusFt] = useState<number>(20);
  const [originHeightFt, setOriginHeightFt] = useState<number>(15);

  const result = useMemo(
    () => computeAirburst(radiusFt, originHeightFt),
    [radiusFt, originHeightFt],
  );

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
            <Target className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-zinc-50">
              PF2e Airburst Calculator
            </h1>
            <p className="text-sm text-stone-600 dark:text-zinc-400">
              Detonate a burst in mid-air to control its ground-level footprint
              · 3D alternating-diagonal rule
            </p>
          </div>
        </div>
      </div>

      {/* Controls + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-5">
          {/* Metric Summary */}
          <div className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-5 shadow-xs">
            <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
              Effective Ground Burst
            </div>
            {result.groundSquaresHit > 0 ? (
              <div className="mt-1 flex items-baseline gap-2.5">
                <span className="text-4xl font-bold tabular-nums text-crimson-700 dark:text-gold-400">
                  {result.effectiveGroundRadiusFt} ft
                </span>
                <span className="text-sm text-stone-500 dark:text-zinc-400">
                  radius ({result.groundWidthFt} ft wide)
                </span>
              </div>
            ) : (
              <div className="mt-1 text-2xl font-bold text-stone-400 dark:text-zinc-500">
                Does not reach ground
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-stone-100 dark:border-zinc-800 space-y-1.5 text-xs text-stone-600 dark:text-zinc-400">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  Ground squares hit:{" "}
                  <strong className="text-stone-900 dark:text-zinc-100">
                    {result.groundSquaresHit}
                  </strong>{" "}
                  sq ({result.groundSquaresHit * 25} sq ft)
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-zinc-500">
                Note: Ground footprint counts Small/Medium targets at ground
                level (0–5 ft).
              </p>
            </div>
          </div>

          {/* Controls Card */}
          <div className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-5 shadow-xs space-y-5">
            {/* Burst Radius */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="airburst-radius"
                  className="text-sm font-medium text-stone-800 dark:text-zinc-200"
                >
                  Burst Radius
                </label>
                <span className="text-sm font-semibold tabular-nums text-crimson-700 dark:text-gold-400">
                  {radiusFt} ft
                </span>
              </div>

              <input
                id="airburst-radius"
                type="range"
                min={5}
                max={120}
                step={5}
                value={radiusFt}
                onChange={(e) => setRadiusFt(Number(e.target.value))}
                className="w-full accent-crimson-600 dark:accent-gold-400 cursor-pointer"
              />

              <div className="flex flex-wrap gap-1.5 pt-1">
                {RADIUS_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRadiusFt(preset)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      radiusFt === preset
                        ? "bg-crimson-600 text-white dark:bg-gold-500 dark:text-zinc-950"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {preset} ft
                  </button>
                ))}
              </div>
            </div>

            {/* Origin Height */}
            <div className="space-y-2.5 pt-2 border-t border-stone-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="airburst-height"
                  className="text-sm font-medium text-stone-800 dark:text-zinc-200"
                >
                  Detonation Height (above ground)
                </label>
                <span className="text-sm font-semibold tabular-nums text-crimson-700 dark:text-gold-400">
                  {originHeightFt} ft
                </span>
              </div>

              <input
                id="airburst-height"
                type="range"
                min={0}
                max={120}
                step={5}
                value={originHeightFt}
                onChange={(e) => setOriginHeightFt(Number(e.target.value))}
                className="w-full accent-crimson-600 dark:accent-gold-400 cursor-pointer"
              />

              <div className="flex flex-wrap gap-1.5 pt-1">
                {HEIGHT_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setOriginHeightFt(preset)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      originHeightFt === preset
                        ? "bg-crimson-600 text-white dark:bg-gold-500 dark:text-zinc-950"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {preset} ft
                  </button>
                ))}
              </div>
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                Both 0 ft and 5 ft origin intersections touch the ground-level
                0–5 ft cubes directly.
              </p>
            </div>
          </div>
        </div>

        {/* Plots */}
        <div className="lg:col-span-7 space-y-6">
          <SideViewGrid
            title={`${radiusFt} ft Burst at ${originHeightFt} ft Height`}
            originLabel="Burst origin"
            result={result}
          />
          <GroundFootprintGrid
            title="Ground-Level Burst Footprint"
            result={result}
          />
        </div>
      </div>
    </div>
  );
}
