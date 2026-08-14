import type { PendingIngredient, RecipeLineSeed } from "./types.js";

/**
 * Resolve a recipe line to Ingredient.id using only:
 * 1) explicit ingredientId on the line, or
 * 2) exact key in mappings.json
 * Never fuzzy / guess by similarity.
 */
export function resolveIngredientId(
  line: RecipeLineSeed,
  mappings: Readonly<Record<string, string>>,
  knownIngredientIds: ReadonlySet<string>,
): { ingredientId: string } | { pending: true } {
  if (line.ingredientId) {
    if (!knownIngredientIds.has(line.ingredientId)) {
      return { pending: true };
    }
    return { ingredientId: line.ingredientId };
  }
  const mapped = mappings[line.sourceName];
  if (mapped && knownIngredientIds.has(mapped)) {
    return { ingredientId: mapped };
  }
  return { pending: true };
}

export function collectPending(
  recipeId: string,
  recipeNameEn: string,
  line: RecipeLineSeed,
  list: PendingIngredient[],
): void {
  list.push({
    sourceName: line.sourceName,
    recipeId,
    recipeNameEn,
    reason: "unmapped_source_name",
  });
}
