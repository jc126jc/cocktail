import type {
  AlcoholGroupMark,
  IngredientNode,
  RecipeInput,
  ScoredRecipe,
} from "./types.js";
import { computeMissingCount } from "./missing.js";

export function matchesAlcoholFilter(input: {
  recipeAlcoholGroupIds: readonly string[];
  selectedAlcoholGroupIds: readonly string[];
}): boolean {
  const selected = input.selectedAlcoholGroupIds;
  if (selected.length === 0) return true;
  const hits = new Set(input.recipeAlcoholGroupIds);
  return selected.every((id) => hits.has(id));
}

export function matchesFamilyFlavor(input: {
  recipe: Pick<RecipeInput, "familyId" | "flavorTagIds">;
  familyIds: readonly string[];
  flavorIds: readonly string[];
}): boolean {
  const { recipe, familyIds, flavorIds } = input;
  if (familyIds.length > 0 && !familyIds.includes(recipe.familyId)) {
    return false;
  }
  if (flavorIds.length > 0) {
    const tags = new Set(recipe.flavorTagIds);
    if (!flavorIds.every((id) => tags.has(id))) return false;
  }
  return true;
}

/** Case-insensitive substring on zh/en names; empty/whitespace q matches all. */
export function matchesNameQuery(input: {
  nameZh: string;
  nameEn: string;
  q?: string | null;
}): boolean {
  const needle = (input.q ?? "").trim().toLowerCase();
  if (!needle) return true;
  return (
    input.nameZh.toLowerCase().includes(needle) ||
    input.nameEn.toLowerCase().includes(needle)
  );
}

/**
 * Collect alcohol groups covered by owned materials (self + ancestors' groups).
 */
export function collectOwnedAlcoholGroupIds(input: {
  ownedIds: ReadonlySet<string>;
  ingredients: Readonly<Record<string, IngredientNode>>;
}): Set<string> {
  const groups = new Set<string>();
  for (const id of input.ownedIds) {
    let current: string | null | undefined = id;
    const seen = new Set<string>();
    while (current) {
      if (seen.has(current)) break;
      seen.add(current);
      const node = input.ingredients[current];
      if (node?.alcoholGroupId) groups.add(node.alcoholGroupId);
      current = node?.parentIngredientId ?? null;
    }
  }
  return groups;
}

export function markOwnedAlcoholGroups(input: {
  ownedIds: ReadonlySet<string>;
  ingredients: Readonly<Record<string, IngredientNode>>;
  alcoholGroupIds: readonly string[];
}): AlcoholGroupMark[] {
  const ownedGroups = collectOwnedAlcoholGroupIds({
    ownedIds: input.ownedIds,
    ingredients: input.ingredients,
  });
  const marks = input.alcoholGroupIds.map((id) => ({
    id,
    owned: ownedGroups.has(id),
  }));
  return [
    ...marks.filter((m) => m.owned),
    ...marks.filter((m) => !m.owned),
  ];
}

export function scoreRecipe(input: {
  recipe: RecipeInput;
  selectedAlcoholGroupIds: readonly string[];
  familyIds: readonly string[];
  flavorIds: readonly string[];
  nameQuery?: string | null;
  satisfiedIds: ReadonlySet<string>;
}): ScoredRecipe {
  const alcoholOk = matchesAlcoholFilter({
    recipeAlcoholGroupIds: input.recipe.alcoholGroupIds,
    selectedAlcoholGroupIds: input.selectedAlcoholGroupIds,
  });
  const facetsOk = matchesFamilyFlavor({
    recipe: input.recipe,
    familyIds: input.familyIds,
    flavorIds: input.flavorIds,
  });
  const nameOk = matchesNameQuery({
    nameZh: input.recipe.nameZh,
    nameEn: input.recipe.nameEn,
    q: input.nameQuery,
  });
  const { missingCount } = computeMissingCount({
    demands: input.recipe.demands,
    satisfiedIds: input.satisfiedIds,
  });
  const hasNameQuery = Boolean((input.nameQuery ?? "").trim());
  // FR-06: browse/filter excludes missing ≥ 3.
  // FR-05a: explicit name search still surfaces name hits (e.g. 长岛) with missing count shown.
  const missingOk = hasNameQuery || missingCount <= 2;
  const eligible = alcoholOk && facetsOk && nameOk && missingOk;
  return { recipe: input.recipe, missingCount, eligible };
}
