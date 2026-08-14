import type { AppDatabase } from "@cocktail/db";
import * as schema from "@cocktail/db/schema";
import {
  applyDeterministicMappings,
  buildIngredientMatchIndex,
  DEFAULT_BRAND_ALIASES,
  DEFAULT_GLASSWARE_ENUM,
  type IngredientCatalogEntry,
} from "@cocktail/domain";
import type { AiParsedRecipe } from "@cocktail/shared";

export function loadIngredientCatalog(db: AppDatabase): IngredientCatalogEntry[] {
  const ingredients = db.select().from(schema.ingredients).all();
  const aliases = db.select().from(schema.ingredientAliases).all();
  const aliasByIng = new Map<string, string[]>();
  for (const row of aliases) {
    const list = aliasByIng.get(row.ingredientId) ?? [];
    list.push(row.alias);
    aliasByIng.set(row.ingredientId, list);
  }
  return ingredients
    .filter((i) => i.active === 1)
    .map((i) => ({
      id: i.id,
      nameZh: i.nameZh,
      nameEn: i.nameEn,
      aliases: aliasByIng.get(i.id) ?? [],
      parentIngredientId: i.parentIngredientId,
    }));
}

/** Only keep brand aliases whose target id exists in catalog. */
export function resolveBrandAliases(
  catalog: readonly IngredientCatalogEntry[],
  brands: Readonly<Record<string, string>> = DEFAULT_BRAND_ALIASES,
): Record<string, string> {
  const ids = new Set(catalog.map((c) => c.id));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(brands)) {
    if (ids.has(v)) out[k] = v;
  }
  return out;
}

export function applyCatalogMappings(
  db: AppDatabase,
  draft: AiParsedRecipe,
): AiParsedRecipe {
  const catalog = loadIngredientCatalog(db);
  const index = buildIngredientMatchIndex({
    ingredients: catalog,
    brandAliases: resolveBrandAliases(catalog),
  });
  return applyDeterministicMappings(draft, {
    index,
    glasswareEnum: DEFAULT_GLASSWARE_ENUM,
  }) as AiParsedRecipe;
}
