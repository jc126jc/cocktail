import { eq } from "drizzle-orm";
import fs from "node:fs";
import type Database from "better-sqlite3";
import type { AppDatabase } from "../index.js";
import * as schema from "../schema.js";
import { collectPending, resolveIngredientId } from "./mapIngredient.js";
import { pendingDir, readJson, writeJson } from "./paths.js";
import type {
  IngredientSeed,
  PendingIngredient,
  RecipeSeed,
  TaxonomyRow,
} from "./types.js";

function clearCatalog(db: AppDatabase): void {
  db.delete(schema.recipeIngredients).run();
  db.delete(schema.recipeFlavorTags).run();
  db.delete(schema.recipeVersions).run();
  db.delete(schema.recipes).run();
  db.delete(schema.ingredientAliases).run();
  db.delete(schema.stapleSettings).run();
  db.delete(schema.shoppingItems).run();
  db.delete(schema.inventoryItems).run();
  db.delete(schema.ingredients).run();
  db.delete(schema.cocktailFamilies).run();
  db.delete(schema.flavorTags).run();
  db.delete(schema.alcoholGroups).run();
  db.delete(schema.ingredientCategories).run();
}

export function runSeed(
  db: AppDatabase,
  sqlite: Database.Database,
): {
  pending: PendingIngredient[];
  recipeCount: number;
  ingredientCount: number;
} {
  const categories = readJson<TaxonomyRow[]>("taxonomy/categories.json");
  const alcoholGroups = readJson<TaxonomyRow[]>("taxonomy/alcohol_groups.json");
  const families = readJson<TaxonomyRow[]>("taxonomy/families.json");
  const flavors = readJson<TaxonomyRow[]>("taxonomy/flavors.json");
  const ingredients = readJson<IngredientSeed[]>("ingredients/ingredients.json");
  const mappings = readJson<Record<string, string>>("ingredients/mappings.json");
  const recipes = readJson<RecipeSeed[]>("recipes/iba_recipes.json");

  const pending: PendingIngredient[] = [];
  const knownIds = new Set(ingredients.map((i) => i.id));

  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const depth = (id: string, seen = new Set<string>()): number => {
    if (seen.has(id)) return 0;
    seen.add(id);
    const node = byId.get(id);
    if (!node?.parentIngredientId) return 0;
    return 1 + depth(node.parentIngredientId, seen);
  };
  const orderedIngredients = [...ingredients].sort(
    (a, b) => depth(a.id) - depth(b.id) || a.id.localeCompare(b.id),
  );

  const seedTx = sqlite.transaction(() => {
    clearCatalog(db);

    db.insert(schema.ingredientCategories)
      .values(
        categories.map((c) => ({
          id: c.id,
          nameZh: c.nameZh,
          nameEn: c.nameEn,
          parentId: c.parentId ?? null,
          sortOrder: c.sortOrder,
          active: c.active,
        })),
      )
      .run();

    db.insert(schema.alcoholGroups)
      .values(
        alcoholGroups.map((g) => ({
          id: g.id,
          nameZh: g.nameZh,
          nameEn: g.nameEn,
          sortOrder: g.sortOrder,
          active: g.active,
        })),
      )
      .run();

    db.insert(schema.cocktailFamilies)
      .values(
        families.map((f) => ({
          id: f.id,
          nameZh: f.nameZh,
          nameEn: f.nameEn,
          sortOrder: f.sortOrder,
          active: f.active,
        })),
      )
      .run();

    db.insert(schema.flavorTags)
      .values(
        flavors.map((f) => ({
          id: f.id,
          nameZh: f.nameZh,
          nameEn: f.nameEn,
          sortOrder: f.sortOrder,
          active: f.active,
        })),
      )
      .run();

    for (const ing of orderedIngredients) {
      db.insert(schema.ingredients)
        .values({
          id: ing.id,
          nameZh: ing.nameZh,
          nameEn: ing.nameEn,
          categoryId: ing.categoryId,
          parentIngredientId: ing.parentIngredientId,
          alcoholGroupId: ing.alcoholGroupId,
          canBeStaple: ing.canBeStaple,
          active: 1,
        })
        .run();
      for (const alias of ing.aliases ?? []) {
        db.insert(schema.ingredientAliases)
          .values({
            id: `${ing.id}::${alias}`,
            ingredientId: ing.id,
            alias,
          })
          .run();
      }
    }

    const recipeEntities = new Map<
      string,
      { seed: RecipeSeed; versions: RecipeSeed[] }
    >();

    for (const recipe of recipes) {
      if (recipe.importKind === "new_recipe") {
        recipeEntities.set(recipe.id, { seed: recipe, versions: [recipe] });
      } else if (recipe.importKind === "new_version") {
        const target = recipe.targetRecipeId;
        if (!target || !recipeEntities.has(target)) {
          throw new Error(
            `new_version ${recipe.id} requires prior new_recipe targetRecipeId`,
          );
        }
        recipeEntities.get(target)!.versions.push(recipe);
      } else {
        throw new Error(`Unknown importKind on ${(recipe as RecipeSeed).id}`);
      }
    }

    for (const [recipeId, entity] of recipeEntities) {
      const head = entity.seed;
      db.insert(schema.recipes)
        .values({
          id: recipeId,
          nameZh: head.nameZh,
          nameEn: head.nameEn,
          primaryVersionId: null,
          familyId: head.familyId,
          editorRecommended: head.editorRecommended ? 1 : 0,
          recommendationOrder: head.recommendationOrder ?? null,
          status: "published",
          ibaCategory: head.ibaCategory,
        })
        .run();

      for (const tagId of head.flavorTagIds) {
        db.insert(schema.recipeFlavorTags)
          .values({ recipeId, flavorTagId: tagId })
          .run();
      }

      let versionIndex = 0;
      let primaryVersionId = "";
      for (const versionSeed of entity.versions) {
        versionIndex += 1;
        const versionId =
          versionSeed.importKind === "new_recipe"
            ? `${recipeId}::v1`
            : `${recipeId}::v${versionIndex}`;
        if (versionSeed.importKind === "new_recipe") {
          primaryVersionId = versionId;
        }

        db.insert(schema.recipeVersions)
          .values({
            id: versionId,
            recipeId,
            versionName:
              versionSeed.importKind === "new_recipe"
                ? "IBA primary"
                : `IBA ${versionSeed.sourceRevision}`,
            sourceName: versionSeed.sourceName,
            sourceUrl: null,
            sourceRevision: versionSeed.sourceRevision,
            glassware: versionSeed.glassware,
            garnish: versionSeed.garnish,
            stepsJson: JSON.stringify(versionSeed.steps),
          })
          .run();

        let sortOrder = 0;
        for (const line of versionSeed.ingredients) {
          const resolved = resolveIngredientId(line, mappings, knownIds);
          if ("pending" in resolved) {
            collectPending(recipeId, versionSeed.nameEn, line, pending);
            continue;
          }
          db.insert(schema.recipeIngredients)
            .values({
              id: `${versionId}::${sortOrder}`,
              recipeVersionId: versionId,
              ingredientId: resolved.ingredientId,
              amountMl: line.amountMl,
              role: line.role,
              eitherGroupId: line.eitherGroupId ?? null,
              displayNote: line.sourceName,
              sortOrder,
            })
            .run();
          sortOrder += 1;
        }
      }

      db.update(schema.recipes)
        .set({ primaryVersionId })
        .where(eq(schema.recipes.id, recipeId))
        .run();
    }
  });

  seedTx();

  fs.mkdirSync(pendingDir, { recursive: true });
  writeJson("pending/unmapped-ingredients.json", {
    generatedAt: new Date().toISOString(),
    count: pending.length,
    items: pending,
    note: "No silent name guessing. Confirm mappings in ingredients/mappings.json then re-run pnpm db:seed.",
  });

  writeJson("pending/mapping-report.json", {
    generatedAt: new Date().toISOString(),
    ingredientCount: ingredients.length,
    recipeEntityCount: recipes.filter((r) => r.importKind === "new_recipe")
      .length,
    sourceRecipeRows: recipes.length,
    pendingCount: pending.length,
    pendingFile: "unmapped-ingredients.json",
  });

  return {
    pending,
    recipeCount: recipes.filter((r) => r.importKind === "new_recipe").length,
    ingredientCount: ingredients.length,
  };
}
