import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Flame } from "lucide-react";
import { computeDragonBreath } from "../../lib/pf2e/vertical";
import { SideViewGrid } from "../../components/grids/SideViewGrid";
import { GroundFootprintGrid } from "../../components/grids/GroundFootprintGrid";

const CONE_PRESETS = [15, 30, 45, 60] as const;
const HEIGHT_PRESETS = [5, 10, 15, 20, 30, 45, 60] as const;

export default function DragonBreathTool() {
  const [coneLengthFt, setConeLengthFt] = useState<number>(30);
  const [dragonHeightFt, setDragonHeightFt] = useState<number>(20);

  const result = useMemo(
    () => computeDragonBreath(coneLengthFt, dragonHeightFt),
    [coneLengthFt, dragonHeightFt],
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
            <Flame className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-zinc-50">
              PF2e Dragon Breath Calculator
            </h1>
            <p className="text-sm text-stone-600 dark:text-zinc-400">
              Aim a breath weapon cone straight down from above to find the
              effective ground burst
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
              Effective Ground Footprint
            </div>
            {result.groundSquaresHit > 0 ? (
              <div className="mt-1 flex items-baseline gap-2.5">
                <span className="text-4xl font-bold tabular-nums text-crimson-700 dark:text-gold-400">
                  {result.groundWidthFt} ft
                </span>
                <span className="text-sm text-stone-500 dark:text-zinc-400">
                  wide ({result.effectiveGroundRadiusFt} ft radius)
                </span>
              </div>
            ) : (
              <div className="mt-1 text-2xl font-bold text-stone-400 dark:text-zinc-500">
                Too high — misses ground
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-stone-100 dark:border-zinc-800 space-y-1.5 text-xs text-stone-600 dark:text-zinc-400">
              <div>
                Ground squares hit:{" "}
                <strong className="text-stone-900 dark:text-zinc-100">
                  {result.groundSquaresHit}
                </strong>{" "}
                sq ({result.groundSquaresHit * 25} sq ft)
              </div>
              <p className="text-[11px] text-stone-500 dark:text-zinc-500">
                Note: Ground footprint counts Small/Medium targets at ground
                level (0–5 ft).
              </p>
            </div>
          </div>

          {/* Controls Card */}
          <div className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-5 shadow-xs space-y-5">
            {/* Cone Length */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="breath-cone-length"
                  className="text-sm font-medium text-stone-800 dark:text-zinc-200"
                >
                  Breath Cone Size
                </label>
                <span className="text-sm font-semibold tabular-nums text-crimson-700 dark:text-gold-400">
                  {coneLengthFt} ft
                </span>
              </div>

              <input
                id="breath-cone-length"
                type="range"
                min={15}
                max={120}
                step={5}
                value={coneLengthFt}
                onChange={(e) => setConeLengthFt(Number(e.target.value))}
                className="w-full accent-crimson-600 dark:accent-gold-400 cursor-pointer"
              />

              <div className="flex flex-wrap gap-1.5 pt-1">
                {CONE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setConeLengthFt(preset)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      coneLengthFt === preset
                        ? "bg-crimson-600 text-white dark:bg-gold-500 dark:text-zinc-950"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {preset} ft
                  </button>
                ))}
              </div>
            </div>

            {/* Dragon Height */}
            <div className="space-y-2.5 pt-2 border-t border-stone-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="dragon-height"
                  className="text-sm font-medium text-stone-800 dark:text-zinc-200"
                >
                  Dragon Elevation (above ground)
                </label>
                <span className="text-sm font-semibold tabular-nums text-crimson-700 dark:text-gold-400">
                  {dragonHeightFt} ft
                </span>
              </div>

              <input
                id="dragon-height"
                type="range"
                min={5}
                max={120}
                step={5}
                value={dragonHeightFt}
                onChange={(e) => setDragonHeightFt(Number(e.target.value))}
                className="w-full accent-crimson-600 dark:accent-gold-400 cursor-pointer"
              />

              <div className="flex flex-wrap gap-1.5 pt-1">
                {HEIGHT_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDragonHeightFt(preset)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      dragonHeightFt === preset
                        ? "bg-crimson-600 text-white dark:bg-gold-500 dark:text-zinc-950"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {preset} ft
                  </button>
                ))}
              </div>
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                Height is measured from the ground to the bottom of the
                dragon&apos;s space where the cone originates.
              </p>
            </div>
          </div>
        </div>

        {/* Plots */}
        <div className="lg:col-span-7 space-y-6">
          <SideViewGrid
            title={`${coneLengthFt} ft Cone Aimed Down from ${dragonHeightFt} ft`}
            originLabel="Dragon origin"
            result={result}
          />
          <GroundFootprintGrid
            title="Effective Ground Burst Footprint"
            result={result}
          />
        </div>
      </div>
    </div>
  );
}
