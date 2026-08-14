import type { ScoredRecipe, SortMode } from "./types.js";

const DEFAULT_FILL_TARGET = 12;

function stableKey(row: ScoredRecipe): string {
  return `${row.recipe.nameZh}\0${row.recipe.nameEn}\0${row.recipe.id}`;
}

function compareStable(a: ScoredRecipe, b: ScoredRecipe): number {
  return (
    a.recipe.nameZh.localeCompare(b.recipe.nameZh, "zh-CN") ||
    a.recipe.nameEn.localeCompare(b.recipe.nameEn, "en") ||
    a.recipe.id.localeCompare(b.recipe.id)
  );
}

/**
 * FR-06: complete first; if |complete| < target, fill with partials (missing 1 then 2).
 * Homepage (default target 12): when complete >= 12, keep all complete (no partials).
 * AI chat (target 6, hardCap): at most 6 rows total.
 * Name-search hits with missing ≥ 3 (FR-05a) are appended after 0–2 tiers within the fill budget.
 */
export function fillResults(
  candidates: readonly ScoredRecipe[],
  options?: { target?: number; hardCap?: boolean },
): ScoredRecipe[] {
  const fillTarget = options?.target ?? DEFAULT_FILL_TARGET;
  const hardCap = options?.hardCap ?? false;
  const eligible = candidates.filter((c) => c.eligible);
  const complete = eligible
    .filter((c) => c.missingCount === 0)
    .slice()
    .sort(compareStable);
  if (complete.length >= fillTarget) {
    return hardCap ? complete.slice(0, fillTarget) : complete;
  }
  const partial = eligible
    .filter((c) => c.missingCount === 1 || c.missingCount === 2)
    .slice()
    .sort((a, b) => a.missingCount - b.missingCount || compareStable(a, b));
  const deep = eligible
    .filter((c) => c.missingCount >= 3)
    .slice()
    .sort((a, b) => a.missingCount - b.missingCount || compareStable(a, b));
  const need = fillTarget - complete.length;
  return [...complete, ...[...partial, ...deep].slice(0, need)];
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 — deterministic shuffle helper. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], seed: string): T[] {
  const out = items.slice();
  const rand = mulberry32(hashSeed(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

export function sortRecipes(
  rows: readonly ScoredRecipe[],
  options: { sort: SortMode; randomSeed?: string },
): ScoredRecipe[] {
  if (options.sort === "random") {
    return shuffle([...rows], options.randomSeed ?? "default");
  }
  if (options.sort === "name") {
    return [...rows].sort(compareStable);
  }
  // completeness
  return [...rows].sort(
    (a, b) => a.missingCount - b.missingCount || compareStable(a, b),
  );
}

export { stableKey, compareStable };
