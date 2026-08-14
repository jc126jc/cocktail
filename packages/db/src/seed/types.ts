export type TaxonomyRow = {
  id: string;
  nameZh: string;
  nameEn: string;
  sortOrder: number;
  active: number;
  parentId?: string | null;
};

export type IngredientSeed = {
  id: string;
  nameZh: string;
  nameEn: string;
  categoryId: string;
  parentIngredientId: string | null;
  alcoholGroupId: string | null;
  canBeStaple: number;
  aliases?: string[];
  hierarchyNote?: string;
};

export type RecipeLineSeed = {
  sourceName: string;
  amountMl: number | null;
  role: "required" | "optional" | "garnish" | "either";
  eitherGroupId?: string;
  /** Explicit id only — never inferred by fuzzy name match. */
  ingredientId?: string;
};

export type RecipeSeed = {
  id: string;
  importKind: "new_recipe" | "new_version";
  targetRecipeId?: string;
  nameZh: string;
  nameEn: string;
  ibaCategory: string;
  sourceName: string;
  sourceRevision: string;
  familyId: string;
  flavorTagIds: string[];
  glassware: string;
  garnish: string;
  steps: string[];
  ingredients: RecipeLineSeed[];
  editorRecommended?: boolean;
  recommendationOrder?: number;
};

export type PendingIngredient = {
  sourceName: string;
  recipeId: string;
  recipeNameEn: string;
  reason: "unmapped_source_name";
};
