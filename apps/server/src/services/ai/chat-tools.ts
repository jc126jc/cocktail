import type { AppDatabase } from "@cocktail/db";
import * as schema from "@cocktail/db/schema";
import { getOwnedState, searchRecipes } from "../matching.js";
import { getRecipeDetail } from "../admin.js";

export type ChatSearchItem = {
  id: string;
  nameZh: string;
  nameEn: string;
  missingCount: number;
  matchReason: string;
  detailPath: string;
};

function namesByIds(
  rows: { id: string; nameZh: string }[],
  ids: string[],
): string[] {
  const map = new Map(rows.map((r) => [r.id, r.nameZh]));
  return ids.map((id) => map.get(id) ?? id);
}

export function formatChatMatchReason(input: {
  q?: string;
  alcoholNames: string[];
  familyNames: string[];
  flavorNames: string[];
}): string {
  const parts: string[] = [];
  const q = input.q?.trim();
  if (q) parts.push(`名字里有「${q}」`);
  if (input.alcoholNames.length === 1) {
    parts.push(`含${input.alcoholNames[0]}`);
  } else if (input.alcoholNames.length >= 2) {
    parts.push(`同时含${input.alcoholNames.join("和")}`);
  }
  if (input.familyNames.length) {
    parts.push(`家族是${input.familyNames.join("或")}`);
  }
  if (input.flavorNames.length) {
    parts.push(`风味要${input.flavorNames.join("、")}`);
  }
  return parts.join("；") || "按酒柜齐全程度来排";
}

export type AiChatTools = {
  searchRecipes: (query: {
    q?: string;
    alcoholGroupIds: string[];
    familyIds: string[];
    flavorIds: string[];
    sort?: "completeness" | "name" | "random";
  }) => Promise<{ items: ChatSearchItem[] }>;
  getRecipe: (id: string) => Promise<unknown>;
  getInventory: () => Promise<{
    items: { ingredientId: string; nameZh?: string; nameEn?: string }[];
  }>;
  checkInventory: (recipeId: string) => Promise<{
    owned: boolean;
    missingCount: number;
    missingIngredientIds: string[];
  }>;
  calculateMissingIngredients: (recipeId: string) => Promise<{
    missingCount: number;
    missingIngredientIds: string[];
  }>;
  listStandardIngredients: () => Promise<{
    items: { id: string; nameZh: string; nameEn: string }[];
  }>;
};

export function createDbAiChatTools(db: AppDatabase): AiChatTools {
  const tools: AiChatTools = {
    async searchRecipes(query) {
      const result = searchRecipes(db, {
        q: query.q,
        alcoholGroupIds: query.alcoholGroupIds,
        familyIds: query.familyIds,
        flavorIds: query.flavorIds,
        sort: query.sort ?? "completeness",
        fillTarget: 6,
        hardCap: true,
      });
      const groups = db.select().from(schema.alcoholGroups).all();
      const families = db.select().from(schema.cocktailFamilies).all();
      const flavors = db.select().from(schema.flavorTags).all();
      const matchReason = formatChatMatchReason({
        q: query.q,
        alcoholNames: namesByIds(groups, query.alcoholGroupIds),
        familyNames: namesByIds(families, query.familyIds),
        flavorNames: namesByIds(flavors, query.flavorIds),
      });

      return {
        items: result.items.map((row) => ({
          id: row.recipe.id,
          nameZh: row.recipe.nameZh,
          nameEn: row.recipe.nameEn,
          missingCount: row.missingCount,
          matchReason,
          detailPath: `/recipes/${row.recipe.id}`,
        })),
      };
    },

    async getRecipe(id) {
      return getRecipeDetail(db, id);
    },

    async getInventory() {
      const { inventory } = getOwnedState(db);
      const ings = db.select().from(schema.ingredients).all();
      const byId = new Map(ings.map((i) => [i.id, i]));
      return {
        items: inventory.map((row) => {
          const ing = byId.get(row.ingredientId);
          return {
            ingredientId: row.ingredientId,
            nameZh: ing?.nameZh,
            nameEn: ing?.nameEn,
          };
        }),
      };
    },

    async calculateMissingIngredients(recipeId) {
      const detail = getRecipeDetail(db, recipeId);
      const missingIngredientIds = detail.version.ingredients
        .filter((l) => (l.role === "required" || l.role === "either") && !l.owned)
        .map((l) => l.ingredientId);
      return {
        missingCount: detail.missingCount,
        missingIngredientIds,
      };
    },

    async checkInventory(recipeId) {
      const miss = await tools.calculateMissingIngredients(recipeId);
      return {
        owned: miss.missingCount === 0,
        missingCount: miss.missingCount,
        missingIngredientIds: miss.missingIngredientIds,
      };
    },

    async listStandardIngredients() {
      const rows = db
        .select()
        .from(schema.ingredients)
        .all()
        .filter((i) => i.active === 1);
      return {
        items: rows.map((i) => ({
          id: i.id,
          nameZh: i.nameZh,
          nameEn: i.nameEn,
        })),
      };
    },
  };
  return tools;
}
