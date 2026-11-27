import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Dices } from "lucide-react";
import {
  buildExpressionPMF,
  computeAdvancedDamage,
  parseDiceExpression,
  summarizePMF,
  type ProbabilityInputMode,
  type ResolutionType,
} from "../../lib/pf2e/damage";
import { ShareLinkButton } from "../../components/ShareLinkButton";
import { CopyImageButton } from "../../components/CopyImageButton";
import { DamageHistogram, type HistogramSeries } from "./DamageHistogram";

type CalcMode = "basic" | "advanced";

const BASIC_PRESETS = [
  "1d8 + 4",
  "2d6 + 2",
  "2d8 + 4",
  "6d6",
  "2d12 + 7",
] as const;

const MAP_PRESETS = [
  { label: "0", value: 0 },
  { label: "-4 (Agile)", value: -4 },
  { label: "-5", value: -5 },
  { label: "-8 (Agile)", value: -8 },
  { label: "-10", value: -10 },
] as const;

const FATAL_OPTIONS: readonly { label: string; value: 0 | 8 | 10 | 12 }[] = [
  { label: "None", value: 0 },
  { label: "Fatal d8", value: 8 },
  { label: "Fatal d10", value: 10 },
  { label: "Fatal d12", value: 12 },
];

function parseIntParam(
  raw: string | null,
  min: number,
  max: number,
  fallback: number,
): number {
  if (raw === null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export default function DamageTool() {
  const [searchParams, setSearchParams] = useSearchParams();
  const histSvgRef = useRef<SVGSVGElement | null>(null);

  const [mode, setMode] = useState<CalcMode>(() =>
    searchParams.get("m") === "advanced" ? "advanced" : "basic",
  );

  // Basic mode state
  const [basicExpr, setBasicExpr] = useState<string>(
    () => searchParams.get("expr") ?? "2d6 + 2",
  );

  // Advanced mode state
  const [resolution, setResolution] = useState<ResolutionType>(() =>
    searchParams.get("res") === "save" ? "save" : "attack",
  );
  const [probMode, setProbMode] = useState<ProbabilityInputMode>(() =>
    searchParams.get("pm") === "raw" ? "raw" : "roll",
  );
  const [rollModifier, setRollModifier] = useState<number>(() =>
    parseIntParam(searchParams.get("mod"), -20, 60, 14),
  );
  const [targetDC, setTargetDC] = useState<number>(() =>
    parseIntParam(searchParams.get("dc"), 1, 80, 22),
  );
  const [extraRollMod, setExtraRollMod] = useState<number>(() =>
    parseIntParam(searchParams.get("emod"), -20, 20, 0),
  );
  const [rawProbPercent, setRawProbPercent] = useState<number>(() =>
    parseIntParam(searchParams.get("p"), 0, 100, 65),
  );
  const [advBaseExpr, setAdvBaseExpr] = useState<string>(
    () => searchParams.get("dmg") ?? "2d8 + 4",
  );
  const [critExtraExpr, setCritExtraExpr] = useState<string>(
    () => searchParams.get("crit") ?? "",
  );
  const [fatalDie, setFatalDie] = useState<0 | 8 | 10 | 12>(() => {
    const raw = Number(searchParams.get("fatal"));
    return raw === 8 || raw === 10 || raw === 12 ? raw : 0;
  });
  const [weakness, setWeakness] = useState<number>(() =>
    parseIntParam(searchParams.get("wk"), 0, 100, 0),
  );
  const [resistance, setResistance] = useState<number>(() =>
    parseIntParam(searchParams.get("rs"), 0, 100, 0),
  );
  const [hideZeroBar, setHideZeroBar] = useState<boolean>(false);

  // Sync URL params
  useEffect(() => {
    const next = new URLSearchParams();
    next.set("m", mode);
    if (mode === "basic") {
      next.set("expr", basicExpr);
    } else {
      next.set("res", resolution);
      next.set("pm", probMode);
      if (probMode === "roll") {
        next.set("mod", String(rollModifier));
        next.set("dc", String(targetDC));
        if (extraRollMod !== 0) next.set("emod", String(extraRollMod));
      } else {
        next.set("p", String(rawProbPercent));
      }
      next.set("dmg", advBaseExpr);
      if (critExtraExpr.trim()) next.set("crit", critExtraExpr.trim());
      if (resolution === "attack" && fatalDie > 0) {
        next.set("fatal", String(fatalDie));
      }
      if (weakness > 0) next.set("wk", String(weakness));
      if (resistance > 0) next.set("rs", String(resistance));
    }
    setSearchParams(next, { replace: true });
  }, [
    mode,
    basicExpr,
    resolution,
    probMode,
    rollModifier,
    targetDC,
    extraRollMod,
    rawProbPercent,
    advBaseExpr,
    critExtraExpr,
    fatalDie,
    weakness,
    resistance,
    setSearchParams,
  ]);

  const basicResult = useMemo(() => {
    const parsed = parseDiceExpression(basicExpr);
    if (!parsed.ok) return { ok: false as const, error: parsed.error };
    const summary = summarizePMF(buildExpressionPMF(parsed.terms));
    return { ok: true as const, normalized: parsed.normalized, summary };
  }, [basicExpr]);

  const advResult = useMemo(
    () =>
      computeAdvancedDamage({
        resolution,
        probMode,
        rollModifier,
        targetDC,
        extraRollMod,
        rawProbPercent,
        baseExpression: advBaseExpr,
        critExtraExpression: critExtraExpr,
        fatalDie,
        weakness,
        resistance,
      }),
    [
      resolution,
      probMode,
      rollModifier,
      targetDC,
      extraRollMod,
      rawProbPercent,
      advBaseExpr,
      critExtraExpr,
      fatalDie,
      weakness,
      resistance,
    ],
  );

  const advSeries: HistogramSeries[] = useMemo(() => {
    if (!advResult.ok) return [];
    const w = advResult.weightedByDegree;
    if (resolution === "attack") {
      return [
        {
          key: "critFailure",
          label: "Crit Miss",
          fillClass: "fill-rose-600 dark:fill-rose-500",
          swatchClass: "bg-rose-600 dark:bg-rose-500",
          pmf: w.critFailure,
        },
        {
          key: "failure",
          label: "Miss",
          fillClass: "fill-amber-500 dark:fill-amber-500",
          swatchClass: "bg-amber-500",
          pmf: w.failure,
        },
        {
          key: "success",
          label: "Hit",
          fillClass: "fill-sky-500 dark:fill-sky-400",
          swatchClass: "bg-sky-500 dark:bg-sky-400",
          pmf: w.success,
        },
        {
          key: "critSuccess",
          label: "Crit Hit",
          fillClass: "fill-emerald-500 dark:fill-emerald-400",
          swatchClass: "bg-emerald-500 dark:bg-emerald-400",
          pmf: w.critSuccess,
        },
      ];
    }
    return [
      {
        key: "critSuccess",
        label: "Crit Save (0)",
        fillClass: "fill-rose-600 dark:fill-rose-500",
        swatchClass: "bg-rose-600 dark:bg-rose-500",
        pmf: w.critSuccess,
      },
      {
        key: "success",
        label: "Save (½)",
        fillClass: "fill-amber-500 dark:fill-amber-500",
        swatchClass: "bg-amber-500",
        pmf: w.success,
      },
      {
        key: "failure",
        label: "Fail (1×)",
        fillClass: "fill-sky-500 dark:fill-sky-400",
        swatchClass: "bg-sky-500 dark:bg-sky-400",
        pmf: w.failure,
      },
      {
        key: "critFailure",
        label: "Crit Fail (2×)",
        fillClass: "fill-emerald-500 dark:fill-emerald-400",
        swatchClass: "bg-emerald-500 dark:bg-emerald-400",
        pmf: w.critFailure,
      },
    ];
  }, [advResult, resolution]);

  const exportTitle =
    mode === "basic"
      ? `Damage Distribution — ${basicResult.ok ? basicResult.normalized : basicExpr}`
      : `PF2e ${resolution === "attack" ? "Attack" : "Basic Save"} Damage — ${advBaseExpr}`;

  const exportSubtitle =
    mode === "basic"
      ? basicResult.ok
        ? `Avg ${basicResult.summary.mean.toFixed(2)} · Median ${basicResult.summary.median} · Range ${basicResult.summary.min}–${basicResult.summary.max}`
        : undefined
      : advResult.ok
        ? `Expected ${advResult.overall.mean.toFixed(2)} dmg · On Hit ${advResult.onHitMean.toFixed(1)} · On Crit ${advResult.onCritMean.toFixed(1)}`
        : undefined;

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
              <Dices className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-zinc-50">
                PF2e Damage Calculator
              </h1>
              <p className="text-sm text-stone-600 dark:text-zinc-400">
                Exact dice distributions, Degrees of Success, on-crit traits
                &amp; weakness/resistance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CopyImageButton
              svgRef={histSvgRef}
              title={exportTitle}
              subtitle={exportSubtitle}
              filename="pf2e-damage-histogram.png"
            />
            <ShareLinkButton />
          </div>
        </div>
      </div>

      {/* Mode Switcher */}
      <div
        className="inline-grid grid-cols-2 gap-1 rounded-lg bg-stone-100 dark:bg-zinc-900 p-1 border border-stone-200 dark:border-zinc-800"
        role="tablist"
        aria-label="Calculator mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "basic"}
          onClick={() => setMode("basic")}
          className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
            mode === "basic"
              ? "bg-crimson-600 text-white shadow-xs dark:bg-gold-500 dark:text-zinc-950"
              : "text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          Basic Mode
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "advanced"}
          onClick={() => setMode("advanced")}
          className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
            mode === "advanced"
              ? "bg-crimson-600 text-white shadow-xs dark:bg-gold-500 dark:text-zinc-950"
              : "text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          Advanced (PF2e)
        </button>
      </div>

      {mode === "basic" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Basic Controls */}
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-5 shadow-xs space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="basic-dice"
                  className="block text-sm font-medium text-stone-800 dark:text-zinc-200"
                >
                  Dice Expression
                </label>
                <input
                  id="basic-dice"
                  type="text"
                  value={basicExpr}
                  onChange={(e) => setBasicExpr(e.target.value)}
                  placeholder="e.g. 2d6 + 2"
                  className="w-full rounded-lg border border-stone-300 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 px-3 py-2 text-base font-mono text-stone-900 dark:text-zinc-100 focus:border-crimson-600 dark:focus:border-gold-400 focus:outline-none"
                />
                {!basicResult.ok && (
                  <p className="text-xs text-crimson-600 dark:text-crimson-400">
                    {basicResult.error}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {BASIC_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setBasicExpr(preset)}
                    className={`rounded-md px-2.5 py-1 text-xs font-mono font-medium transition-colors cursor-pointer ${
                      basicExpr.trim() === preset
                        ? "bg-crimson-600 text-white dark:bg-gold-500 dark:text-zinc-950"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {basicResult.ok && (
              <div className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-5 shadow-xs space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                    Average Damage
                  </div>
                  <div className="mt-1 text-4xl font-bold tabular-nums text-crimson-700 dark:text-gold-400">
                    {basicResult.summary.mean.toFixed(2)}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-stone-100 dark:border-zinc-800 text-xs">
                  <div>
                    <span className="block text-stone-500 dark:text-zinc-400">
                      Min – Max
                    </span>
                    <strong className="text-sm text-stone-900 dark:text-zinc-100 tabular-nums">
                      {basicResult.summary.min} – {basicResult.summary.max}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-stone-500 dark:text-zinc-400">
                      Median
                    </span>
                    <strong className="text-sm text-stone-900 dark:text-zinc-100 tabular-nums">
                      {basicResult.summary.median}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-stone-500 dark:text-zinc-400">
                      Std Dev
                    </span>
                    <strong className="text-sm text-stone-900 dark:text-zinc-100 tabular-nums">
                      {basicResult.summary.stdDev.toFixed(2)}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Basic Histogram */}
          <div className="lg:col-span-7">
            {basicResult.ok ? (
              <DamageHistogram
                title={`Probability Distribution (${basicResult.normalized})`}
                summary={basicResult.summary}
                svgRef={histSvgRef}
              />
            ) : (
              <div className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-8 text-center text-sm text-stone-500 dark:text-zinc-400">
                Enter a valid dice expression to see the histogram.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Advanced PF2e Mode */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Advanced Controls */}
          <div className="lg:col-span-5 space-y-5">
            {/* Resolution & Probability Card */}
            <div className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-5 shadow-xs space-y-4">
              {/* Attack vs Basic Save */}
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-stone-100 dark:bg-zinc-950 p-1 border border-stone-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setResolution("attack")}
                  className={`rounded-md py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    resolution === "attack"
                      ? "bg-crimson-600 text-white dark:bg-gold-500 dark:text-zinc-950"
                      : "text-stone-600 dark:text-zinc-400"
                  }`}
                >
                  Attack Roll
                </button>
                <button
                  type="button"
                  onClick={() => setResolution("save")}
                  className={`rounded-md py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    resolution === "save"
                      ? "bg-crimson-600 text-white dark:bg-gold-500 dark:text-zinc-950"
                      : "text-stone-600 dark:text-zinc-400"
                  }`}
                >
                  Basic Save
                </button>
              </div>

              {/* Roll vs Raw Probability */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-stone-700 dark:text-zinc-300">
                  Chance Input
                </span>
                <div className="inline-flex rounded-md border border-stone-200 dark:border-zinc-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setProbMode("roll")}
                    className={`px-2.5 py-1 font-medium cursor-pointer ${
                      probMode === "roll"
                        ? "bg-stone-800 text-white dark:bg-zinc-200 dark:text-zinc-950"
                        : "bg-stone-50 text-stone-600 dark:bg-zinc-950 dark:text-zinc-400"
                    }`}
                  >
                    {resolution === "attack" ? "Bonus vs AC" : "Save vs DC"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setProbMode("raw")}
                    className={`px-2.5 py-1 font-medium cursor-pointer ${
                      probMode === "raw"
                        ? "bg-stone-800 text-white dark:bg-zinc-200 dark:text-zinc-950"
                        : "bg-stone-50 text-stone-600 dark:bg-zinc-950 dark:text-zinc-400"
                    }`}
                  >
                    Raw %
                  </button>
                </div>
              </div>

              {probMode === "roll" ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="roll-mod"
                        className="block text-xs font-medium text-stone-600 dark:text-zinc-400 mb-1"
                      >
                        {resolution === "attack"
                          ? "Attack Bonus"
                          : "Target Save Bonus"}
                      </label>
                      <input
                        id="roll-mod"
                        type="number"
                        min={-20}
                        max={60}
                        value={rollModifier}
                        onChange={(e) =>
                          setRollModifier(Number(e.target.value) || 0)
                        }
                        className="w-full rounded-lg border border-stone-300 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 px-3 py-1.5 text-sm tabular-nums text-stone-900 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="target-dc"
                        className="block text-xs font-medium text-stone-600 dark:text-zinc-400 mb-1"
                      >
                        {resolution === "attack"
                          ? "Target AC"
                          : "Spell / Effect DC"}
                      </label>
                      <input
                        id="target-dc"
                        type="number"
                        min={1}
                        max={80}
                        value={targetDC}
                        onChange={(e) =>
                          setTargetDC(Number(e.target.value) || 10)
                        }
                        className="w-full rounded-lg border border-stone-300 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 px-3 py-1.5 text-sm tabular-nums text-stone-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="extra-mod"
                        className="text-xs font-medium text-stone-600 dark:text-zinc-400"
                      >
                        {resolution === "attack"
                          ? "Extra Modifier (MAP, Bless, Off-Guard, etc.)"
                          : "Save Modifier (Frightened, Clumsy, Status, etc.)"}
                      </label>
                      <span className="text-xs font-semibold tabular-nums text-crimson-700 dark:text-gold-400">
                        {extraRollMod >= 0 ? `+${extraRollMod}` : extraRollMod}
                      </span>
                    </div>
                    <input
                      id="extra-mod"
                      type="number"
                      min={-20}
                      max={20}
                      value={extraRollMod}
                      onChange={(e) =>
                        setExtraRollMod(Number(e.target.value) || 0)
                      }
                      className="w-full rounded-lg border border-stone-300 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 px-3 py-1.5 text-sm tabular-nums text-stone-900 dark:text-zinc-100"
                    />
                    {resolution === "attack" && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {MAP_PRESETS.map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => setExtraRollMod(p.value)}
                            className={`rounded px-2 py-0.5 text-[11px] font-medium cursor-pointer ${
                              extraRollMod === p.value
                                ? "bg-crimson-600 text-white dark:bg-gold-500 dark:text-zinc-950"
                                : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-300"
                            }`}
                          >
                            MAP {p.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="raw-prob"
                      className="text-xs font-medium text-stone-600 dark:text-zinc-400"
                    >
                      {resolution === "attack"
                        ? "Hit Chance % (includes Crit)"
                        : "Target Save Success % (includes Crit Success)"}
                    </label>
                    <span className="text-sm font-semibold tabular-nums text-crimson-700 dark:text-gold-400">
                      {rawProbPercent}%
                    </span>
                  </div>
                  <input
                    id="raw-prob"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={rawProbPercent}
                    onChange={(e) => setRawProbPercent(Number(e.target.value))}
                    className="w-full accent-crimson-600 dark:accent-gold-400 cursor-pointer"
                  />
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                    Crit % is automatically derived using PF2e&apos;s ±10 rule
                    and Natural 20 / Natural 1 shifts.
                  </p>
                </div>
              )}

              {/* Degrees of Success bar */}
              {advResult.ok && (
                <div className="pt-2 border-t border-stone-100 dark:border-zinc-800 space-y-2">
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-zinc-800">
                    {resolution === "attack" ? (
                      <>
                        <div
                          style={{
                            width: `${advResult.degrees.critSuccess * 100}%`,
                          }}
                          className="bg-emerald-500 dark:bg-emerald-400"
                          title="Crit Hit"
                        />
                        <div
                          style={{
                            width: `${advResult.degrees.success * 100}%`,
                          }}
                          className="bg-sky-500 dark:bg-sky-400"
                          title="Hit"
                        />
                        <div
                          style={{
                            width: `${advResult.degrees.failure * 100}%`,
                          }}
                          className="bg-amber-500"
                          title="Miss"
                        />
                        <div
                          style={{
                            width: `${advResult.degrees.critFailure * 100}%`,
                          }}
                          className="bg-rose-600 dark:bg-rose-500"
                          title="Crit Miss"
                        />
                      </>
                    ) : (
                      <>
                        <div
                          style={{
                            width: `${advResult.degrees.critFailure * 100}%`,
                          }}
                          className="bg-emerald-500 dark:bg-emerald-400"
                          title="Crit Fail (2×)"
                        />
                        <div
                          style={{
                            width: `${advResult.degrees.failure * 100}%`,
                          }}
                          className="bg-sky-500 dark:bg-sky-400"
                          title="Fail (1×)"
                        />
                        <div
                          style={{
                            width: `${advResult.degrees.success * 100}%`,
                          }}
                          className="bg-amber-500"
                          title="Save (½)"
                        />
                        <div
                          style={{
                            width: `${advResult.degrees.critSuccess * 100}%`,
                          }}
                          className="bg-rose-600 dark:bg-rose-500"
                          title="Crit Save (0)"
                        />
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap justify-between gap-2 text-[11px] text-stone-600 dark:text-zinc-400 tabular-nums">
                    {resolution === "attack" ? (
                      <>
                        <span>
                          Crit:{" "}
                          <strong className="text-emerald-600 dark:text-emerald-400">
                            {(advResult.degrees.critSuccess * 100).toFixed(0)}%
                          </strong>
                        </span>
                        <span>
                          Hit:{" "}
                          <strong className="text-sky-600 dark:text-sky-400">
                            {(advResult.degrees.success * 100).toFixed(0)}%
                          </strong>
                        </span>
                        <span>
                          Miss:{" "}
                          <strong className="text-amber-600 dark:text-amber-400">
                            {(advResult.degrees.failure * 100).toFixed(0)}%
                          </strong>
                        </span>
                        <span>
                          Crit Miss:{" "}
                          <strong className="text-rose-600 dark:text-rose-400">
                            {(advResult.degrees.critFailure * 100).toFixed(0)}%
                          </strong>
                        </span>
                      </>
                    ) : (
                      <>
                        <span>
                          Crit Fail (2×):{" "}
                          <strong className="text-emerald-600 dark:text-emerald-400">
                            {(advResult.degrees.critFailure * 100).toFixed(0)}%
                          </strong>
                        </span>
                        <span>
                          Fail (1×):{" "}
                          <strong className="text-sky-600 dark:text-sky-400">
                            {(advResult.degrees.failure * 100).toFixed(0)}%
                          </strong>
                        </span>
                        <span>
                          Save (½):{" "}
                          <strong className="text-amber-600 dark:text-amber-400">
                            {(advResult.degrees.success * 100).toFixed(0)}%
                          </strong>
                        </span>
                        <span>
                          Crit Save (0):{" "}
                          <strong className="text-rose-600 dark:text-rose-400">
                            {(advResult.degrees.critSuccess * 100).toFixed(0)}%
                          </strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Damage, Crits, Weakness/Resistance Card */}
            <div className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-5 shadow-xs space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="adv-base-dmg"
                  className="block text-xs font-medium text-stone-600 dark:text-zinc-400"
                >
                  Base Damage Expression
                </label>
                <input
                  id="adv-base-dmg"
                  type="text"
                  value={advBaseExpr}
                  onChange={(e) => setAdvBaseExpr(e.target.value)}
                  placeholder="e.g. 2d8 + 4"
                  className="w-full rounded-lg border border-stone-300 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 px-3 py-1.5 text-sm font-mono text-stone-900 dark:text-zinc-100 focus:border-crimson-600 dark:focus:border-gold-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="crit-extra"
                    className="block text-xs font-medium text-stone-600 dark:text-zinc-400"
                  >
                    On-Crit Extra (Deadly / bonus)
                  </label>
                  <input
                    id="crit-extra"
                    type="text"
                    value={critExtraExpr}
                    onChange={(e) => setCritExtraExpr(e.target.value)}
                    placeholder="e.g. 1d8 or 2d10 + 2"
                    className="w-full rounded-lg border border-stone-300 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 px-3 py-1.5 text-sm font-mono text-stone-900 dark:text-zinc-100 focus:border-crimson-600 dark:focus:border-gold-400 focus:outline-none"
                  />
                </div>

                {resolution === "attack" && (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="fatal-die"
                      className="block text-xs font-medium text-stone-600 dark:text-zinc-400"
                    >
                      Fatal Trait
                    </label>
                    <select
                      id="fatal-die"
                      value={fatalDie}
                      onChange={(e) =>
                        setFatalDie(Number(e.target.value) as 0 | 8 | 10 | 12)
                      }
                      className="w-full rounded-lg border border-stone-300 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 px-3 py-1.5 text-sm text-stone-900 dark:text-zinc-100"
                    >
                      {FATAL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-100 dark:border-zinc-800">
                <div>
                  <label
                    htmlFor="weakness"
                    className="block text-xs font-medium text-stone-600 dark:text-zinc-400 mb-1"
                  >
                    Target Weakness
                  </label>
                  <input
                    id="weakness"
                    type="number"
                    min={0}
                    max={100}
                    value={weakness}
                    onChange={(e) =>
                      setWeakness(Math.max(0, Number(e.target.value) || 0))
                    }
                    className="w-full rounded-lg border border-stone-300 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 px-3 py-1.5 text-sm tabular-nums text-stone-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="resistance"
                    className="block text-xs font-medium text-stone-600 dark:text-zinc-400 mb-1"
                  >
                    Target Resistance
                  </label>
                  <input
                    id="resistance"
                    type="number"
                    min={0}
                    max={100}
                    value={resistance}
                    onChange={(e) =>
                      setResistance(Math.max(0, Number(e.target.value) || 0))
                    }
                    className="w-full rounded-lg border border-stone-300 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 px-3 py-1.5 text-sm tabular-nums text-stone-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              {!advResult.ok && (
                <p className="text-xs text-crimson-600 dark:text-crimson-400">
                  {advResult.error}
                </p>
              )}
            </div>
          </div>

          {/* Advanced Output & Histogram */}
          <div className="lg:col-span-7 space-y-5">
            {advResult.ok ? (
              <>
                <div className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-5 shadow-xs">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                        Expected Damage
                      </div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-4xl font-bold tabular-nums text-crimson-700 dark:text-gold-400">
                          {advResult.overall.mean.toFixed(2)}
                        </span>
                        <span className="text-xs text-stone-500 dark:text-zinc-400">
                          avg per {resolution === "attack" ? "Strike" : "Save"}
                        </span>
                      </div>
                    </div>

                    <div className="text-right text-xs text-stone-600 dark:text-zinc-400 space-y-0.5 tabular-nums">
                      <div>
                        Chance to deal damage:{" "}
                        <strong className="text-stone-900 dark:text-zinc-100">
                          {(advResult.overall.chanceNonZero * 100).toFixed(1)}%
                        </strong>
                      </div>
                      <div>
                        Range:{" "}
                        <strong className="text-stone-900 dark:text-zinc-100">
                          {advResult.overall.min} – {advResult.overall.max}
                        </strong>
                      </div>
                      <div>
                        Min (on hit):{" "}
                        <strong className="text-stone-900 dark:text-zinc-100">
                          {advResult.overall.bins.find((b) => b.value > 0)
                            ?.value ?? 0}
                        </strong>{" "}
                        · Max:{" "}
                        <strong className="text-stone-900 dark:text-zinc-100">
                          {advResult.overall.max}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-stone-100 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs tabular-nums">
                    <div>
                      <span className="block text-stone-500 dark:text-zinc-400">
                        {resolution === "attack"
                          ? "On Hit (1×)"
                          : "On Fail (1×)"}
                      </span>
                      <strong className="text-sm text-stone-900 dark:text-zinc-100">
                        {advResult.onHitMean.toFixed(1)}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-stone-500 dark:text-zinc-400">
                        {resolution === "attack"
                          ? "On Crit (2×+)"
                          : "On Crit Fail (2×+)"}
                      </span>
                      <strong className="text-sm text-crimson-700 dark:text-gold-400">
                        {advResult.onCritMean.toFixed(1)}
                      </strong>
                    </div>
                    {advResult.onHalfMean !== null && (
                      <div>
                        <span className="block text-stone-500 dark:text-zinc-400">
                          On Success (½)
                        </span>
                        <strong className="text-sm text-blue-600 dark:text-blue-400">
                          {advResult.onHalfMean.toFixed(1)}
                        </strong>
                      </div>
                    )}
                    <div>
                      <span className="block text-stone-500 dark:text-zinc-400">
                        Median / Std Dev
                      </span>
                      <strong className="text-sm text-stone-900 dark:text-zinc-100">
                        {advResult.overall.median} /{" "}
                        {advResult.overall.stdDev.toFixed(1)}
                      </strong>
                    </div>
                  </div>
                </div>

                <DamageHistogram
                  title="Overall Damage Distribution"
                  summary={advResult.overall}
                  series={advSeries}
                  hideZero={hideZeroBar}
                  onToggleHideZero={setHideZeroBar}
                  showHideZeroOption={advResult.overall.min === 0}
                  svgRef={histSvgRef}
                />
              </>
            ) : (
              <div className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-8 text-center text-sm text-stone-500 dark:text-zinc-400">
                Fix the dice expression error to see the damage breakdown and
                histogram.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
