import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { AppDatabase } from "@cocktail/db";
import * as schema from "@cocktail/db/schema";
import type Database from "better-sqlite3";
import { badRequest, conflict, notFound } from "../http.js";

export function listInventory(db: AppDatabase) {
  const items = db.select().from(schema.inventoryItems).all();
  return { items };
}

export function addInventory(db: AppDatabase, ingredientId: string) {
  const ing = db
    .select()
    .from(schema.ingredients)
    .where(eq(schema.ingredients.id, ingredientId))
    .get();
  if (!ing) throw notFound("Ingredient not found");
  const existing = db
    .select()
    .from(schema.inventoryItems)
    .where(eq(schema.inventoryItems.ingredientId, ingredientId))
    .get();
  if (!existing) {
    db.insert(schema.inventoryItems)
      .values({ id: randomUUID(), ingredientId })
      .run();
  }
  return { ok: true, ingredientId };
}

export function removeInventory(db: AppDatabase, ingredientId: string) {
  db.delete(schema.inventoryItems)
    .where(eq(schema.inventoryItems.ingredientId, ingredientId))
    .run();
  return { ok: true };
}

export function listStaples(db: AppDatabase) {
  const can = db
    .select()
    .from(schema.ingredients)
    .where(eq(schema.ingredients.canBeStaple, 1))
    .all();
  const settings = db.select().from(schema.stapleSettings).all();
  const enabled = new Map(settings.map((s) => [s.ingredientId, s.enabled === 1]));
  return {
    items: can.map((i) => ({
      ingredientId: i.id,
      nameZh: i.nameZh,
      nameEn: i.nameEn,
      enabled: enabled.get(i.id) ?? false,
    })),
  };
}

export function setStaple(
  db: AppDatabase,
  ingredientId: string,
  enabled: boolean,
) {
  const ing = db
    .select()
    .from(schema.ingredients)
    .where(eq(schema.ingredients.id, ingredientId))
    .get();
  if (!ing) throw notFound("Ingredient not found");
  if (ing.canBeStaple !== 1) {
    throw badRequest("Ingredient cannot be set as staple");
  }
  const existing = db
    .select()
    .from(schema.stapleSettings)
    .where(eq(schema.stapleSettings.ingredientId, ingredientId))
    .get();
  if (existing) {
    db.update(schema.stapleSettings)
      .set({ enabled: enabled ? 1 : 0 })
      .where(eq(schema.stapleSettings.ingredientId, ingredientId))
      .run();
  } else {
    db.insert(schema.stapleSettings)
      .values({ ingredientId, enabled: enabled ? 1 : 0 })
      .run();
  }
  return { ok: true, ingredientId, enabled };
}

export function listShopping(db: AppDatabase) {
  return { items: db.select().from(schema.shoppingItems).all() };
}

export function addShopping(db: AppDatabase, ingredientId: string) {
  const ing = db
    .select()
    .from(schema.ingredients)
    .where(eq(schema.ingredients.id, ingredientId))
    .get();
  if (!ing) throw notFound("Ingredient not found");
  const existing = db
    .select()
    .from(schema.shoppingItems)
    .where(eq(schema.shoppingItems.ingredientId, ingredientId))
    .get();
  if (!existing) {
    db.insert(schema.shoppingItems)
      .values({ id: randomUUID(), ingredientId })
      .run();
  }
  return { ok: true, ingredientId };
}

export function removeShopping(db: AppDatabase, ingredientId: string) {
  db.delete(schema.shoppingItems)
    .where(eq(schema.shoppingItems.ingredientId, ingredientId))
    .run();
  return { ok: true };
}

export function purchaseItem(
  db: AppDatabase,
  sqlite: Database.Database,
  ingredientId: string,
) {
  const shopping = db
    .select()
    .from(schema.shoppingItems)
    .where(eq(schema.shoppingItems.ingredientId, ingredientId))
    .get();
  if (!shopping) throw notFound("Shopping item not found");

  const tx = sqlite.transaction(() => {
    const inv = db
      .select()
      .from(schema.inventoryItems)
      .where(eq(schema.inventoryItems.ingredientId, ingredientId))
      .get();
    if (!inv) {
      db.insert(schema.inventoryItems)
        .values({ id: randomUUID(), ingredientId })
        .run();
    }
    db.delete(schema.shoppingItems)
      .where(eq(schema.shoppingItems.ingredientId, ingredientId))
      .run();
  });
  tx();
  return { ok: true, ingredientId };
}

export function ingredientReferenceCounts(db: AppDatabase, ingredientId: string) {
  const recipes = db
    .select()
    .from(schema.recipeIngredients)
    .where(eq(schema.recipeIngredients.ingredientId, ingredientId))
    .all().length;
  const inventory = db
    .select()
    .from(schema.inventoryItems)
    .where(eq(schema.inventoryItems.ingredientId, ingredientId))
    .all().length;
  const shopping = db
    .select()
    .from(schema.shoppingItems)
    .where(eq(schema.shoppingItems.ingredientId, ingredientId))
    .all().length;
  return { recipes, inventory, shopping };
}

export function assertIngredientDeletable(db: AppDatabase, ingredientId: string) {
  const details = ingredientReferenceCounts(db, ingredientId);
  if (details.recipes + details.inventory + details.shopping > 0) {
    throw conflict("Ingredient is referenced", details);
  }
}
