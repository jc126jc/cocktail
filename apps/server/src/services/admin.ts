import { computeMissingCount } from "@cocktail/domain";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { AppDatabase } from "@cocktail/db";
import * as schema from "@cocktail/db/schema";
import { badRequest, notFound } from "../http.js";
import { assertIngredientDeletable } from "./bar.js";
import { getOwnedState } from "./matching.js";

export function createRecipe(
  db: AppDatabase,
  body: {
    id?: string;
    nameZh: string;
    nameEn: string;
    familyId: string;
    flavorTagIds: string[];
    editorRecommended?: boolean;
    recommendationOrder?: number | null;
    status?: "draft" | "published";
    ibaCategory?: string | null;
  },
) {
  if (body.status === "published") {
    throw badRequest("Create as draft first, then publish");
  }
  const id = body.id ?? randomUUID();
  db.insert(schema.recipes)
    .values({
      id,
      nameZh: body.nameZh,
      nameEn: body.nameEn,
      primaryVersionId: null,
      familyId: body.familyId,
      editorRecommended: body.editorRecommended ? 1 : 0,
      recommendationOrder: body.recommendationOrder ?? null,
      status: "draft",
      ibaCategory: body.ibaCategory ?? null,
    })
    .run();
  for (const tagId of body.flavorTagIds) {
    db.insert(schema.recipeFlavorTags)
      .values({ recipeId: id, flavorTagId: tagId })
      .run();
  }
  return { id };
}

export function createVersion(
  db: AppDatabase,
  recipeId: string,
  body: {
    id?: string;
    versionName: string;
    sourceName: string;
    sourceUrl?: string | null;
    sourceRevision?: string | null;
    glassware?: string | null;
    garnish?: string | null;
    steps: string[];
    ingredients: {
      ingredientId: string;
      amountMl?: number | null;
      role: string;
      eitherGroupId?: string | null;
      displayNote?: string | null;
      sortOrder?: number;
    }[];
  },
) {
  const recipe = db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.id, recipeId))
    .get();
  if (!recipe) throw notFound("Recipe not found");

  const id = body.id ?? randomUUID();
  db.insert(schema.recipeVersions)
    .values({
      id,
      recipeId,
      versionName: body.versionName,
      sourceName: body.sourceName,
      sourceUrl: body.sourceUrl ?? null,
      sourceRevision: body.sourceRevision ?? null,
      glassware: body.glassware ?? null,
      garnish: body.garnish ?? null,
      stepsJson: JSON.stringify(body.steps),
    })
    .run();

  body.ingredients.forEach((line, index) => {
    db.insert(schema.recipeIngredients)
      .values({
        id: randomUUID(),
        recipeVersionId: id,
        ingredientId: line.ingredientId,
        amountMl: line.amountMl ?? null,
        role: line.role,
        eitherGroupId: line.eitherGroupId ?? null,
        displayNote: line.displayNote ?? null,
        sortOrder: line.sortOrder ?? index,
      })
      .run();
  });

  return { id };
}

export function setPrimaryVersion(
  db: AppDatabase,
  recipeId: string,
  versionId: string,
) {
  const recipe = db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.id, recipeId))
    .get();
  if (!recipe) throw notFound("Recipe not found");
  const version = db
    .select()
    .from(schema.recipeVersions)
    .where(eq(schema.recipeVersions.id, versionId))
    .get();
  if (!version || version.recipeId !== recipeId) {
    throw badRequest("Version does not belong to recipe");
  }
  db.update(schema.recipes)
    .set({ primaryVersionId: versionId })
    .where(eq(schema.recipes.id, recipeId))
    .run();
  return { ok: true, recipeId, versionId };
}

export function publishRecipe(
  db: AppDatabase,
  recipeId: string,
  status: "draft" | "published",
) {
  const recipe = db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.id, recipeId))
    .get();
  if (!recipe) throw notFound("Recipe not found");

  if (status === "draft") {
    db.update(schema.recipes)
      .set({ status: "draft" })
      .where(eq(schema.recipes.id, recipeId))
      .run();
    return { ok: true, status: "draft" };
  }

  const errors: string[] = [];
  if (!recipe.nameZh) errors.push("nameZh required");
  if (!recipe.nameEn) errors.push("nameEn required");
  if (!recipe.familyId) errors.push("familyId required");
  if (!recipe.primaryVersionId) errors.push("primaryVersionId required");

  const flavors = db
    .select()
    .from(schema.recipeFlavorTags)
    .where(eq(schema.recipeFlavorTags.recipeId, recipeId))
    .all();
  if (flavors.length < 1) errors.push("at least one flavor required");

  if (recipe.primaryVersionId) {
    const version = db
      .select()
      .from(schema.recipeVersions)
      .where(eq(schema.recipeVersions.id, recipe.primaryVersionId))
      .get();
    if (!version) errors.push("primary version missing");
    else {
      if (!version.sourceName) errors.push("sourceName required");
      const steps = JSON.parse(version.stepsJson) as unknown[];
      if (!Array.isArray(steps) || steps.length < 1) {
        errors.push("at least one step required");
      }
      const lines = db
        .select()
        .from(schema.recipeIngredients)
        .where(
          eq(schema.recipeIngredients.recipeVersionId, recipe.primaryVersionId),
        )
        .all();
      if (lines.length < 1) errors.push("at least one ingredient required");
    }
  }

  if (errors.length) throw badRequest("Publish validation failed", { errors });

  db.update(schema.recipes)
    .set({ status: "published" })
    .where(eq(schema.recipes.id, recipeId))
    .run();
  return { ok: true, status: "published" };
}

export function getAdminRecipe(db: AppDatabase, recipeId: string) {
  const recipe = db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.id, recipeId))
    .get();
  if (!recipe) throw notFound("Recipe not found");

  const flavorRows = db
    .select()
    .from(schema.recipeFlavorTags)
    .where(eq(schema.recipeFlavorTags.recipeId, recipeId))
    .all();

  let version: {
    id: string;
    versionName: string;
    sourceName: string;
    sourceRevision: string | null;
    glassware: string | null;
    garnish: string | null;
    steps: string[];
    ingredients: {
      ingredientId: string;
      amountMl: number | null;
      role: string;
      eitherGroupId: string | null;
      displayNote: string | null;
      sortOrder: number;
    }[];
  } | null = null;

  if (recipe.primaryVersionId) {
    const v = db
      .select()
      .from(schema.recipeVersions)
      .where(eq(schema.recipeVersions.id, recipe.primaryVersionId))
      .get();
    if (v) {
      const lines = db
        .select()
        .from(schema.recipeIngredients)
        .where(eq(schema.recipeIngredients.recipeVersionId, v.id))
        .all()
        .sort((a, b) => a.sortOrder - b.sortOrder);
      version = {
        id: v.id,
        versionName: v.versionName,
        sourceName: v.sourceName,
        sourceRevision: v.sourceRevision,
        glassware: v.glassware,
        garnish: v.garnish,
        steps: JSON.parse(v.stepsJson) as string[],
        ingredients: lines.map((l) => ({
          ingredientId: l.ingredientId,
          amountMl: l.amountMl,
          role: l.role,
          eitherGroupId: l.eitherGroupId,
          displayNote: l.displayNote,
          sortOrder: l.sortOrder,
        })),
      };
    }
  }

  return {
    id: recipe.id,
    nameZh: recipe.nameZh,
    nameEn: recipe.nameEn,
    familyId: recipe.familyId,
    status: recipe.status,
    ibaCategory: recipe.ibaCategory,
    editorRecommended: recipe.editorRecommended === 1,
    recommendationOrder: recipe.recommendationOrder,
    primaryVersionId: recipe.primaryVersionId,
    flavorTagIds: flavorRows.map((f) => f.flavorTagId),
    version,
  };
}

export function updateRecipe(
  db: AppDatabase,
  recipeId: string,
  body: {
    nameZh?: string;
    nameEn?: string;
    familyId?: string;
    flavorTagIds?: string[];
    editorRecommended?: boolean;
    recommendationOrder?: number | null;
    ibaCategory?: string | null;
  },
) {
  const recipe = db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.id, recipeId))
    .get();
  if (!recipe) throw notFound("Recipe not found");

  db.update(schema.recipes)
    .set({
      nameZh: body.nameZh ?? recipe.nameZh,
      nameEn: body.nameEn ?? recipe.nameEn,
      familyId: body.familyId ?? recipe.familyId,
      editorRecommended:
        body.editorRecommended === undefined
          ? recipe.editorRecommended
          : body.editorRecommended
            ? 1
            : 0,
      recommendationOrder:
        body.recommendationOrder === undefined
          ? recipe.recommendationOrder
          : body.recommendationOrder,
      ibaCategory:
        body.ibaCategory === undefined ? recipe.ibaCategory : body.ibaCategory,
    })
    .where(eq(schema.recipes.id, recipeId))
    .run();

  if (body.flavorTagIds) {
    db.delete(schema.recipeFlavorTags)
      .where(eq(schema.recipeFlavorTags.recipeId, recipeId))
      .run();
    for (const tagId of body.flavorTagIds) {
      db.insert(schema.recipeFlavorTags)
        .values({ recipeId, flavorTagId: tagId })
        .run();
    }
  }

  return getAdminRecipe(db, recipeId);
}

export function deleteRecipe(db: AppDatabase, recipeId: string) {
  const recipe = db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.id, recipeId))
    .get();
  if (!recipe) throw notFound("Recipe not found");

  const versions = db
    .select()
    .from(schema.recipeVersions)
    .where(eq(schema.recipeVersions.recipeId, recipeId))
    .all();

  for (const v of versions) {
    db.delete(schema.recipeIngredients)
      .where(eq(schema.recipeIngredients.recipeVersionId, v.id))
      .run();
  }
  db.delete(schema.recipeVersions)
    .where(eq(schema.recipeVersions.recipeId, recipeId))
    .run();
  db.delete(schema.recipeFlavorTags)
    .where(eq(schema.recipeFlavorTags.recipeId, recipeId))
    .run();
  // clear primary pointer first to avoid dangling self-ref semantics
  db.update(schema.recipes)
    .set({ primaryVersionId: null })
    .where(eq(schema.recipes.id, recipeId))
    .run();
  db.delete(schema.recipes).where(eq(schema.recipes.id, recipeId)).run();
  return { ok: true };
}

export function createIngredient(
  db: AppDatabase,
  body: {
    id?: string;
    nameZh: string;
    nameEn: string;
    categoryId: string;
    parentIngredientId?: string | null;
    alcoholGroupId?: string | null;
    canBeStaple?: boolean;
    aliases?: string[];
    active?: boolean;
  },
) {
  const id = body.id ?? randomUUID();
  db.insert(schema.ingredients)
    .values({
      id,
      nameZh: body.nameZh,
      nameEn: body.nameEn,
      categoryId: body.categoryId,
      parentIngredientId: body.parentIngredientId ?? null,
      alcoholGroupId: body.alcoholGroupId ?? null,
      canBeStaple: body.canBeStaple ? 1 : 0,
      active: body.active === false ? 0 : 1,
    })
    .run();
  for (const alias of body.aliases ?? []) {
    db.insert(schema.ingredientAliases)
      .values({ id: randomUUID(), ingredientId: id, alias })
      .run();
  }
  return { id };
}

export function updateIngredient(
  db: AppDatabase,
  ingredientId: string,
  body: {
    nameZh?: string;
    nameEn?: string;
    categoryId?: string;
    parentIngredientId?: string | null;
    alcoholGroupId?: string | null;
    canBeStaple?: boolean;
    active?: boolean;
  },
) {
  const existing = db
    .select()
    .from(schema.ingredients)
    .where(eq(schema.ingredients.id, ingredientId))
    .get();
  if (!existing) throw notFound("Ingredient not found");

  const patch: Partial<typeof existing> = {};
  if (body.nameZh !== undefined) patch.nameZh = body.nameZh;
  if (body.nameEn !== undefined) patch.nameEn = body.nameEn;
  if (body.categoryId !== undefined) patch.categoryId = body.categoryId;
  if (body.parentIngredientId !== undefined) {
    patch.parentIngredientId = body.parentIngredientId;
  }
  if (body.alcoholGroupId !== undefined) {
    patch.alcoholGroupId = body.alcoholGroupId;
  }
  if (body.canBeStaple !== undefined) {
    patch.canBeStaple = body.canBeStaple ? 1 : 0;
  }
  if (body.active !== undefined) patch.active = body.active ? 1 : 0;

  if (Object.keys(patch).length > 0) {
    db.update(schema.ingredients)
      .set(patch)
      .where(eq(schema.ingredients.id, ingredientId))
      .run();
  }
  if (body.canBeStaple === false) {
    db.delete(schema.stapleSettings)
      .where(eq(schema.stapleSettings.ingredientId, ingredientId))
      .run();
  }

  const updated = db
    .select()
    .from(schema.ingredients)
    .where(eq(schema.ingredients.id, ingredientId))
    .get();
  if (!updated) throw notFound("Ingredient not found");
  return updated;
}

export function deleteIngredient(db: AppDatabase, ingredientId: string) {
  const ing = db
    .select()
    .from(schema.ingredients)
    .where(eq(schema.ingredients.id, ingredientId))
    .get();
  if (!ing) throw notFound("Ingredient not found");
  assertIngredientDeletable(db, ingredientId);
  db.delete(schema.ingredientAliases)
    .where(eq(schema.ingredientAliases.ingredientId, ingredientId))
    .run();
  db.delete(schema.ingredients)
    .where(eq(schema.ingredients.id, ingredientId))
    .run();
  return { ok: true };
}

export function getRecipeDetail(db: AppDatabase, recipeId: string) {
  const recipe = db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.id, recipeId))
    .get();
  if (!recipe || recipe.status !== "published" || !recipe.primaryVersionId) {
    throw notFound("Recipe not found");
  }
  const version = db
    .select()
    .from(schema.recipeVersions)
    .where(eq(schema.recipeVersions.id, recipe.primaryVersionId))
    .get();
  if (!version) throw notFound("Primary version not found");

  const lines = db
    .select()
    .from(schema.recipeIngredients)
    .where(eq(schema.recipeIngredients.recipeVersionId, version.id))
    .all()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const { satisfiedIds, ownedIds } = getOwnedState(db);
  const shopping = new Set(
    db
      .select()
      .from(schema.shoppingItems)
      .all()
      .map((s) => s.ingredientId),
  );

  const missing = computeMissingCount({
    demands: lines.map((l) => ({
      ingredientId: l.ingredientId,
      role: l.role as "required" | "optional" | "garnish" | "either",
      eitherGroupId: l.eitherGroupId,
    })),
    satisfiedIds,
  });

  const family = db
    .select()
    .from(schema.cocktailFamilies)
    .where(eq(schema.cocktailFamilies.id, recipe.familyId))
    .get();
  const flavorRows = db
    .select()
    .from(schema.recipeFlavorTags)
    .where(eq(schema.recipeFlavorTags.recipeId, recipeId))
    .all();
  const flavors = flavorRows.map((f) =>
    db
      .select()
      .from(schema.flavorTags)
      .where(eq(schema.flavorTags.id, f.flavorTagId))
      .get(),
  );

  const ingredientRows = db.select().from(schema.ingredients).all();
  const nameById = new Map(ingredientRows.map((i) => [i.id, i.nameZh]));

  return {
    id: recipe.id,
    nameZh: recipe.nameZh,
    nameEn: recipe.nameEn,
    ibaCategory: recipe.ibaCategory,
    family,
    flavors: flavors.filter(Boolean),
    placeholderImageUrl: "/placeholder-cocktail.svg",
    missingCount: missing.missingCount,
    version: {
      id: version.id,
      versionName: version.versionName,
      sourceName: version.sourceName,
      sourceRevision: version.sourceRevision,
      glassware: version.glassware,
      garnish: version.garnish,
      steps: JSON.parse(version.stepsJson) as string[],
      ingredients: lines.map((l) => ({
        ingredientId: l.ingredientId,
        amountMl: l.amountMl,
        role: l.role,
        eitherGroupId: l.eitherGroupId,
        displayNote: l.displayNote,
        nameZh: nameById.get(l.ingredientId) ?? l.ingredientId,
        owned: satisfiedIds.has(l.ingredientId),
        inShopping: shopping.has(l.ingredientId),
      })),
    },
    ownedCount: ownedIds.size,
  };
}

export function listIngredientsQuery(
  db: AppDatabase,
  opts: { q?: string; categoryId?: string },
) {
  let rows = db.select().from(schema.ingredients).all();
  if (opts.categoryId) {
    rows = rows.filter((r) => r.categoryId === opts.categoryId);
  }
  if (opts.q) {
    const q = opts.q.toLowerCase();
    const aliases = db.select().from(schema.ingredientAliases).all();
    const aliasHit = new Set(
      aliases
        .filter((a) => a.alias.toLowerCase().includes(q))
        .map((a) => a.ingredientId),
    );
    rows = rows.filter(
      (r) =>
        r.nameZh.toLowerCase().includes(q) ||
        r.nameEn.toLowerCase().includes(q) ||
        aliasHit.has(r.id),
    );
  }
  const categories = db.select().from(schema.ingredientCategories).all();
  return {
    items: rows,
    categories,
  };
}
