import { relations, sql } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  index,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

/** TECH_SPEC §6 schema — no seed data in P0. */

export const ingredientCategories = sqliteTable(
  "ingredient_categories",
  {
    id: text("id").primaryKey(),
    nameZh: text("name_zh").notNull(),
    nameEn: text("name_en").notNull(),
    parentId: text("parent_id").references(
      (): AnySQLiteColumn => ingredientCategories.id,
    ),
    sortOrder: integer("sort_order").notNull().default(0),
    active: integer("active").notNull().default(1),
  },
  (t) => [index("ingredient_categories_parent_id_idx").on(t.parentId)],
);

export const alcoholGroups = sqliteTable("alcohol_groups", {
  id: text("id").primaryKey(),
  nameZh: text("name_zh").notNull(),
  nameEn: text("name_en").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active").notNull().default(1),
});

export const ingredients = sqliteTable(
  "ingredients",
  {
    id: text("id").primaryKey(),
    nameZh: text("name_zh").notNull(),
    nameEn: text("name_en").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => ingredientCategories.id),
    parentIngredientId: text("parent_ingredient_id").references(
      (): AnySQLiteColumn => ingredients.id,
    ),
    alcoholGroupId: text("alcohol_group_id").references(() => alcoholGroups.id),
    canBeStaple: integer("can_be_staple").notNull().default(0),
    active: integer("active").notNull().default(1),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    index("ingredients_parent_ingredient_id_idx").on(t.parentIngredientId),
    index("ingredients_alcohol_group_id_idx").on(t.alcoholGroupId),
    index("ingredients_category_id_idx").on(t.categoryId),
  ],
);

export const ingredientAliases = sqliteTable(
  "ingredient_aliases",
  {
    id: text("id").primaryKey(),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredients.id),
    alias: text("alias").notNull(),
  },
  (t) => [index("ingredient_aliases_alias_idx").on(t.alias)],
);

export const inventoryItems = sqliteTable(
  "inventory_items",
  {
    id: text("id").primaryKey(),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredients.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("inventory_items_ingredient_id_uidx").on(t.ingredientId)],
);

export const stapleSettings = sqliteTable("staple_settings", {
  ingredientId: text("ingredient_id")
    .primaryKey()
    .references(() => ingredients.id),
  enabled: integer("enabled").notNull().default(0),
});

export const cocktailFamilies = sqliteTable("cocktail_families", {
  id: text("id").primaryKey(),
  nameZh: text("name_zh").notNull(),
  nameEn: text("name_en").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active").notNull().default(1),
});

export const flavorTags = sqliteTable("flavor_tags", {
  id: text("id").primaryKey(),
  nameZh: text("name_zh").notNull(),
  nameEn: text("name_en").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active").notNull().default(1),
});

export const recipes = sqliteTable(
  "recipes",
  {
    id: text("id").primaryKey(),
    nameZh: text("name_zh").notNull(),
    nameEn: text("name_en").notNull(),
    primaryVersionId: text("primary_version_id"),
    familyId: text("family_id")
      .notNull()
      .references(() => cocktailFamilies.id),
    editorRecommended: integer("editor_recommended").notNull().default(0),
    recommendationOrder: integer("recommendation_order"),
    status: text("status").notNull().default("draft"),
    ibaCategory: text("iba_category"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("recipes_status_editor_recommended_idx").on(t.status, t.editorRecommended)],
);

export const recipeFlavorTags = sqliteTable(
  "recipe_flavor_tags",
  {
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id),
    flavorTagId: text("flavor_tag_id")
      .notNull()
      .references(() => flavorTags.id),
  },
  (t) => [
    uniqueIndex("recipe_flavor_tags_uidx").on(t.recipeId, t.flavorTagId),
  ],
);

export const recipeVersions = sqliteTable("recipe_versions", {
  id: text("id").primaryKey(),
  recipeId: text("recipe_id")
    .notNull()
    .references(() => recipes.id),
  versionName: text("version_name").notNull(),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url"),
  sourceRevision: text("source_revision"),
  glassware: text("glassware"),
  garnish: text("garnish"),
  stepsJson: text("steps_json").notNull().default("[]"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const recipeIngredients = sqliteTable(
  "recipe_ingredients",
  {
    id: text("id").primaryKey(),
    recipeVersionId: text("recipe_version_id")
      .notNull()
      .references(() => recipeVersions.id),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredients.id),
    amountMl: real("amount_ml"),
    role: text("role").notNull(),
    eitherGroupId: text("either_group_id"),
    displayNote: text("display_note"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("recipe_ingredients_recipe_version_id_idx").on(t.recipeVersionId),
  ],
);

export const shoppingItems = sqliteTable(
  "shopping_items",
  {
    id: text("id").primaryKey(),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredients.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("shopping_items_ingredient_id_uidx").on(t.ingredientId)],
);

export const ingredientCategoriesRelations = relations(
  ingredientCategories,
  ({ one, many }) => ({
    parent: one(ingredientCategories, {
      fields: [ingredientCategories.parentId],
      references: [ingredientCategories.id],
      relationName: "category_tree",
    }),
    children: many(ingredientCategories, { relationName: "category_tree" }),
    ingredients: many(ingredients),
  }),
);

export const ingredientsRelations = relations(ingredients, ({ one, many }) => ({
  category: one(ingredientCategories, {
    fields: [ingredients.categoryId],
    references: [ingredientCategories.id],
  }),
  alcoholGroup: one(alcoholGroups, {
    fields: [ingredients.alcoholGroupId],
    references: [alcoholGroups.id],
  }),
  parent: one(ingredients, {
    fields: [ingredients.parentIngredientId],
    references: [ingredients.id],
    relationName: "ingredient_tree",
  }),
  children: many(ingredients, { relationName: "ingredient_tree" }),
  aliases: many(ingredientAliases),
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  family: one(cocktailFamilies, {
    fields: [recipes.familyId],
    references: [cocktailFamilies.id],
  }),
  primaryVersion: one(recipeVersions, {
    fields: [recipes.primaryVersionId],
    references: [recipeVersions.id],
  }),
  versions: many(recipeVersions),
  flavorTags: many(recipeFlavorTags),
}));
