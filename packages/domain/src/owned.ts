import type { IngredientNode, StapleSetting } from "./types.js";

export function buildOwnedIds(input: {
  inventoryIngredientIds: readonly string[];
  stapleSettings: readonly StapleSetting[];
}): Set<string> {
  const owned = new Set(input.inventoryIngredientIds);
  for (const staple of input.stapleSettings) {
    if (staple.enabled) owned.add(staple.ingredientId);
  }
  return owned;
}

/**
 * From each owned ingredient, walk parents upward.
 * Child satisfies ancestors; ancestors do not satisfy more specific children.
 */
export function buildSatisfiedIds(input: {
  ownedIds: ReadonlySet<string>;
  ingredients: Readonly<Record<string, IngredientNode>>;
}): Set<string> {
  const satisfied = new Set<string>();
  for (const id of input.ownedIds) {
    let current: string | null | undefined = id;
    const seen = new Set<string>();
    while (current) {
      if (seen.has(current)) break;
      seen.add(current);
      satisfied.add(current);
      const node = input.ingredients[current];
      current = node?.parentIngredientId ?? null;
    }
  }
  return satisfied;
}
