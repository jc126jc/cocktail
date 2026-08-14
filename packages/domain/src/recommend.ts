import type {
  HomeRecommendation,
  MarkedRecipe,
  ScoredRecipe,
} from "./types.js";

function isRecommended(row: ScoredRecipe): boolean {
  return row.recipe.editorRecommended === true;
}

function compareRecommendation(a: ScoredRecipe, b: ScoredRecipe): number {
  const orderA = a.recipe.recommendationOrder;
  const orderB = b.recipe.recommendationOrder;
  const hasA = orderA != null;
  const hasB = orderB != null;
  if (hasA && hasB && orderA !== orderB) return orderA! - orderB!;
  if (hasA && !hasB) return -1;
  if (!hasA && hasB) return 1;
  return (
    a.recipe.nameZh.localeCompare(b.recipe.nameZh, "zh-CN") ||
    a.recipe.id.localeCompare(b.recipe.id)
  );
}

function pickTopRecommended(
  candidates: readonly ScoredRecipe[],
  limit: number,
): ScoredRecipe[] {
  const pool = candidates.filter(isRecommended);
  const byTier = [0, 1, 2].flatMap((missing) =>
    pool
      .filter((c) => c.missingCount === missing)
      .slice()
      .sort(compareRecommendation),
  );
  return byTier.slice(0, limit);
}

export function pickHomeRecommendations(input: {
  candidates: readonly ScoredRecipe[];
  barIsEmpty: boolean;
}): HomeRecommendation[] {
  const top = pickTopRecommended(input.candidates, 2);
  if (input.barIsEmpty) {
    return top.map((row) => ({
      ...row,
      completenessKnown: false,
      statusLabel: "无法判断齐全" as const,
    }));
  }
  return top.map((row) => ({
    ...row,
    completenessKnown: true,
  }));
}

/**
 * Mark up to 2 recommended recipes already in `result`. Does not reorder.
 */
export function markInListRecommendations(
  result: readonly ScoredRecipe[],
): MarkedRecipe[] {
  const pickIds = new Set(
    pickTopRecommended(result, 2).map((r) => r.recipe.id),
  );
  return result.map((row) => ({
    ...row,
    recommended: pickIds.has(row.recipe.id),
  }));
}
