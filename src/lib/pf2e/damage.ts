export type PMF = Map<number, number>;

export interface DiceTerm {
  kind: "dice";
  sign: 1 | -1;
  count: number;
  sides: number;
}

export interface FlatTerm {
  kind: "flat";
  sign: 1 | -1;
  value: number;
}

export type ExpressionTerm = DiceTerm | FlatTerm;

export type ParseResult =
  | { ok: true; terms: ExpressionTerm[]; normalized: string }
  | { ok: false; error: string };

/**
 * Parses a dice expression such as "2d6 + 2", "1d8 + 4 + 1d6", "3d10 - 1", or "d12".
 */
export function parseDiceExpression(input: string): ParseResult {
  const cleaned = input.replace(/\s+/g, "").toLowerCase();
  if (!cleaned) {
    return { ok: false, error: "Enter a dice expression like 2d6 + 2." };
  }

  const tokenRegex = /([+-]?)(\d*d\d+|\d+)/g;
  const terms: ExpressionTerm[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(cleaned)) !== null) {
    if (match.index !== lastIndex) {
      return {
        ok: false,
        error: `Unexpected token near "${cleaned.slice(lastIndex, match.index + 4)}".`,
      };
    }
    const [full, signStr, body] = match;
    if (terms.length > 0 && signStr === "") {
      return { ok: false, error: `Missing + or - before "${body}".` };
    }
    const sign: 1 | -1 = signStr === "-" ? -1 : 1;

    if (body.includes("d")) {
      const [countStr, sidesStr] = body.split("d");
      const count = countStr === "" ? 1 : Number(countStr);
      const sides = Number(sidesStr);
      if (!Number.isInteger(count) || count < 1 || count > 100) {
        return { ok: false, error: "Dice count must be between 1 and 100." };
      }
      if (!Number.isInteger(sides) || sides < 2 || sides > 100) {
        return { ok: false, error: "Die sides must be between 2 and 100." };
      }
      terms.push({ kind: "dice", sign, count, sides });
    } else {
      const value = Number(body);
      if (!Number.isInteger(value) || value < 0 || value > 1000) {
        return { ok: false, error: "Flat modifiers must be between 0 and 1000." };
      }
      terms.push({ kind: "flat", sign, value });
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex !== cleaned.length || terms.length === 0) {
    return {
      ok: false,
      error: `Could not parse "${input}". Try something like "2d6 + 2".`,
    };
  }

  const normalized = terms
    .map((t, idx) => {
      const prefix = idx === 0 ? (t.sign === -1 ? "-" : "") : t.sign === -1 ? " - " : " + ";
      return t.kind === "dice"
        ? `${prefix}${t.count}d${t.sides}`
        : `${prefix}${t.value}`;
    })
    .join("");

  return { ok: true, terms, normalized };
}

/**
 * Discrete convolution of two independent probability mass functions.
 */
export function convolvePMF(a: PMF, b: PMF): PMF {
  const out: PMF = new Map();
  for (const [va, pa] of a) {
    for (const [vb, pb] of b) {
      const sum = va + vb;
      out.set(sum, (out.get(sum) ?? 0) + pa * pb);
    }
  }
  return out;
}

function singleDiePMF(sides: number, sign: 1 | -1): PMF {
  const p = 1 / sides;
  const dist: PMF = new Map();
  for (let face = 1; face <= sides; face++) {
    dist.set(face * sign, p);
  }
  return dist;
}

/**
 * Computes the exact probability distribution for a parsed dice expression.
 * Optionally upgrades the first dice term's die size (for PF2e Fatal trait on crits).
 */
export function buildExpressionPMF(
  terms: readonly ExpressionTerm[],
  fatalDieSides?: number,
): PMF {
  let dist: PMF = new Map([[0, 1]]);
  let upgradedFatal = false;

  for (const term of terms) {
    if (term.kind === "flat") {
      const delta = term.value * term.sign;
      const next: PMF = new Map();
      for (const [v, p] of dist) {
        next.set(v + delta, (next.get(v + delta) ?? 0) + p);
      }
      dist = next;
    } else {
      const sides =
        fatalDieSides && !upgradedFatal && term.sign === 1
          ? ((upgradedFatal = true), Math.max(term.sides, fatalDieSides))
          : term.sides;
      const die = singleDiePMF(sides, term.sign);
      for (let i = 0; i < term.count; i++) {
        dist = convolvePMF(dist, die);
      }
    }
  }

  return dist;
}

/**
 * Maps every outcome value in a PMF through `fn`.
 */
export function mapPMF(dist: PMF, fn: (v: number) => number): PMF {
  const out: PMF = new Map();
  for (const [v, p] of dist) {
    const nv = fn(v);
    out.set(nv, (out.get(nv) ?? 0) + p);
  }
  return out;
}

/**
 * Combines mutually exclusive outcome distributions weighted by their probabilities.
 */
export function combineWeightedPMF(
  branches: readonly { weight: number; dist: PMF }[],
): PMF {
  const out: PMF = new Map();
  for (const { weight, dist } of branches) {
    if (weight <= 0) continue;
    for (const [v, p] of dist) {
      out.set(v, (out.get(v) ?? 0) + weight * p);
    }
  }
  return out;
}

export interface HistogramBin {
  value: number;
  probability: number;
  cumulativeAtLeast: number;
}

export interface DistributionSummary {
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  chanceNonZero: number;
  bins: HistogramBin[];
}

export function summarizePMF(dist: PMF): DistributionSummary {
  const entries = Array.from(dist.entries())
    .filter(([, p]) => p > 1e-12)
    .sort((a, b) => a[0] - b[0]);

  if (entries.length === 0) {
    return {
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      stdDev: 0,
      chanceNonZero: 0,
      bins: [],
    };
  }

  let mean = 0;
  let chanceNonZero = 0;
  for (const [v, p] of entries) {
    mean += v * p;
    if (v > 0) chanceNonZero += p;
  }

  let variance = 0;
  for (const [v, p] of entries) {
    variance += p * (v - mean) * (v - mean);
  }
  const stdDev = Math.sqrt(Math.max(0, variance));

  let cumulative = 0;
  let median = entries[0][0];
  let foundMedian = false;
  for (const [v, p] of entries) {
    cumulative += p;
    if (!foundMedian && cumulative >= 0.5) {
      median = v;
      foundMedian = true;
    }
  }

  // Compute P(X >= value) from right to left
  const bins: HistogramBin[] = new Array(entries.length);
  let tail = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    const [value, probability] = entries[i];
    tail += probability;
    bins[i] = { value, probability, cumulativeAtLeast: Math.min(1, tail) };
  }

  return {
    mean,
    median,
    min: entries[0][0],
    max: entries[entries.length - 1][0],
    stdDev,
    chanceNonZero: Math.min(1, chanceNonZero),
    bins,
  };
}

// ---------------------------------------------------------------------------
// PF2e Degrees of Success
// ---------------------------------------------------------------------------

export interface DegreesOfSuccess {
  critSuccess: number;
  success: number;
  failure: number;
  critFailure: number;
}

/**
 * Exact PF2e d20 Degrees of Success for a roll with `modifier` against `dc`
 * (including ±10 crit thresholds and Natural 20 / Natural 1 degree shifts).
 */
export function computeDegreesOfSuccess(
  modifier: number,
  dc: number,
): DegreesOfSuccess {
  let critSuccess = 0;
  let success = 0;
  let failure = 0;
  let critFailure = 0;

  for (let roll = 1; roll <= 20; roll++) {
    const total = roll + modifier;
    let degree: number;
    if (total >= dc + 10) degree = 3;
    else if (total >= dc) degree = 2;
    else if (total > dc - 10) degree = 1;
    else degree = 0;

    if (roll === 20) degree = Math.min(3, degree + 1);
    else if (roll === 1) degree = Math.max(0, degree - 1);

    if (degree === 3) critSuccess += 0.05;
    else if (degree === 2) success += 0.05;
    else if (degree === 1) failure += 0.05;
    else critFailure += 0.05;
  }

  return { critSuccess, success, failure, critFailure };
}

/**
 * Derives PF2e Degrees of Success from a raw success probability `successProb` (0..1),
 * applying PF2e's +10/-10 (-50% probability shift) and Nat 20 / Nat 1 (5% floor) rules.
 */
export function degreesFromRawProbability(
  successProb: number,
): DegreesOfSuccess {
  const s = Math.max(0, Math.min(1, successProb));
  const f = 1 - s;

  const critSuccess =
    s <= 0 ? 0 : Math.min(s, Math.max(Math.min(s, 0.05), s - 0.5));
  const success = Math.max(0, s - critSuccess);

  const critFailure =
    f <= 0 ? 0 : Math.min(f, Math.max(Math.min(f, 0.05), f - 0.5));
  const failure = Math.max(0, f - critFailure);

  return { critSuccess, success, failure, critFailure };
}

// ---------------------------------------------------------------------------
// Advanced PF2e Damage Calculation
// ---------------------------------------------------------------------------

export type ResolutionType = "attack" | "save";
export type ProbabilityInputMode = "roll" | "raw";

export interface AdvancedDamageConfig {
  resolution: ResolutionType;
  probMode: ProbabilityInputMode;
  /** Attack bonus (for attack) or Target Save bonus (for save). */
  rollModifier: number;
  /** Target AC (for attack) or Spell/Effect DC (for save). */
  targetDC: number;
  /** Extra net modifier to the roll (e.g., MAP, Bless, Frightened). */
  extraRollMod: number;
  /** Raw probability in percent (0–100): Hit+Crit % for attack, Target Save Success % for save. */
  rawProbPercent: number;
  /** Base damage expression (e.g., "2d8 + 4"). */
  baseExpression: string;
  /** Extra dice added only on a Crit Hit / Crit Failed Save (e.g., Deadly "1d8"). */
  critExtraExpression: string;
  /** Optional PF2e Fatal die size (0 = none, 8/10/12). Attack mode only. */
  fatalDie: 0 | 8 | 10 | 12;
  /** Target weakness (applied on any damaging outcome). */
  weakness: number;
  /** Target resistance (subtracted on any damaging outcome, min 0). */
  resistance: number;
}

export type OutcomeKey = "critSuccess" | "success" | "failure" | "critFailure";

export interface AdvancedDamageResult {
  ok: true;
  degrees: DegreesOfSuccess;
  overall: DistributionSummary;
  /** Weighted PMF per degree of success (values already multiplied by degree probability). */
  weightedByDegree: Record<OutcomeKey, PMF>;
  onHitMean: number;
  onCritMean: number;
  onHalfMean: number | null;
}

export type AdvancedDamageOutput =
  | AdvancedDamageResult
  | { ok: false; error: string };

function scaleProbabilities(dist: PMF, weight: number): PMF {
  const out: PMF = new Map();
  if (weight <= 0) return out;
  for (const [v, p] of dist) {
    out.set(v, p * weight);
  }
  return out;
}

function applyWeaknessAndResistance(
  dist: PMF,
  weakness: number,
  resistance: number,
): PMF {
  const net = weakness - resistance;
  return mapPMF(dist, (v) => {
    const base = Math.max(0, v);
    if (base === 0) return 0;
    return Math.max(0, base + net);
  });
}

export function computeAdvancedDamage(
  config: AdvancedDamageConfig,
): AdvancedDamageOutput {
  const baseParsed = parseDiceExpression(config.baseExpression);
  if (!baseParsed.ok) {
    return { ok: false, error: `Base damage: ${baseParsed.error}` };
  }

  let critExtraDist: PMF = new Map([[0, 1]]);
  if (config.critExtraExpression.trim() !== "") {
    const critParsed = parseDiceExpression(config.critExtraExpression);
    if (!critParsed.ok) {
      return { ok: false, error: `On-crit damage: ${critParsed.error}` };
    }
    critExtraDist = buildExpressionPMF(critParsed.terms);
  }

  const degrees =
    config.probMode === "raw"
      ? degreesFromRawProbability(config.rawProbPercent / 100)
      : computeDegreesOfSuccess(
          config.rollModifier + config.extraRollMod,
          config.targetDC,
        );

  // Normal hit / failed save damage
  const rawBaseDist = buildExpressionPMF(baseParsed.terms);
  const normalDist = applyWeaknessAndResistance(
    rawBaseDist,
    config.weakness,
    config.resistance,
  );

  // Crit hit / crit failed save damage:
  // 1) If Fatal (attack only): upgrade base dice before doubling, then add 1 extra fatal die after doubling
  const fatalDie =
    config.resolution === "attack" && config.fatalDie > 0
      ? config.fatalDie
      : undefined;
  const critBasePreDouble = fatalDie
    ? buildExpressionPMF(baseParsed.terms, fatalDie)
    : rawBaseDist;
  let critCombined = mapPMF(critBasePreDouble, (v) => Math.max(0, v) * 2);
  if (fatalDie) {
    critCombined = convolvePMF(critCombined, singleDiePMF(fatalDie, 1));
  }
  if (config.critExtraExpression.trim() !== "") {
    critCombined = convolvePMF(critCombined, critExtraDist);
  }
  const critDist = applyWeaknessAndResistance(
    critCombined,
    config.weakness,
    config.resistance,
  );

  const zeroDist: PMF = new Map([[0, 1]]);

  if (config.resolution === "attack") {
    const weightedByDegree: Record<OutcomeKey, PMF> = {
      critSuccess: scaleProbabilities(critDist, degrees.critSuccess),
      success: scaleProbabilities(normalDist, degrees.success),
      failure: scaleProbabilities(zeroDist, degrees.failure),
      critFailure: scaleProbabilities(zeroDist, degrees.critFailure),
    };

    const overallPMF = combineWeightedPMF([
      { weight: degrees.critSuccess, dist: critDist },
      { weight: degrees.success, dist: normalDist },
      { weight: degrees.failure + degrees.critFailure, dist: zeroDist },
    ]);

    return {
      ok: true,
      degrees,
      overall: summarizePMF(overallPMF),
      weightedByDegree,
      onHitMean: summarizePMF(normalDist).mean,
      onCritMean: summarizePMF(critDist).mean,
      onHalfMean: null,
    };
  }

  // Basic Save:
  // Target Crit Success -> 0
  // Target Success -> floor(base / 2), then weakness/resistance
  // Target Failure -> base, then weakness/resistance
  // Target Crit Failure -> 2 * base + crit extra, then weakness/resistance
  const halfRaw = mapPMF(rawBaseDist, (v) => Math.floor(Math.max(0, v) / 2));
  const halfDist = applyWeaknessAndResistance(
    halfRaw,
    config.weakness,
    config.resistance,
  );

  const weightedByDegree: Record<OutcomeKey, PMF> = {
    critSuccess: scaleProbabilities(zeroDist, degrees.critSuccess),
    success: scaleProbabilities(halfDist, degrees.success),
    failure: scaleProbabilities(normalDist, degrees.failure),
    critFailure: scaleProbabilities(critDist, degrees.critFailure),
  };

  const overallPMF = combineWeightedPMF([
    { weight: degrees.critSuccess, dist: zeroDist },
    { weight: degrees.success, dist: halfDist },
    { weight: degrees.failure, dist: normalDist },
    { weight: degrees.critFailure, dist: critDist },
  ]);

  return {
    ok: true,
    degrees,
    overall: summarizePMF(overallPMF),
    weightedByDegree,
    onHitMean: summarizePMF(normalDist).mean,
    onCritMean: summarizePMF(critDist).mean,
    onHalfMean: summarizePMF(halfDist).mean,
  };
}
