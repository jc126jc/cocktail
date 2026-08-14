/** Serializable domain types for matching / fill / recommend. */

export type IngredientRole = "required" | "optional" | "garnish" | "either";

export type IngredientNode = {
  id: string;
  parentIngredientId: string | null;
  alcoholGroupId: string | null;
};

export type StapleSetting = {
  ingredientId: string;
  enabled: boolean;
};

export type RecipeDemand = {
  ingredientId: string;
  role: IngredientRole;
  eitherGroupId?: string | null;
};

export type RecipeInput = {
  id: string;
  nameZh: string;
  nameEn: string;
  familyId: string;
  flavorTagIds: string[];
  alcoholGroupIds: string[];
  demands: RecipeDemand[];
  editorRecommended?: boolean;
  recommendationOrder?: number | null;
};

export type ScoredRecipe = {
  recipe: RecipeInput;
  missingCount: number;
  eligible: boolean;
};

export type SortMode = "completeness" | "name" | "random";

export type AlcoholGroupMark = {
  id: string;
  owned: boolean;
};

export type HomeRecommendation = ScoredRecipe & {
  completenessKnown: boolean;
  statusLabel?: "无法判断齐全";
};

export type MarkedRecipe = ScoredRecipe & {
  recommended: boolean;
};
