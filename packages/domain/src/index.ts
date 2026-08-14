/**
 * Pure matching / fill / recommend engine (P1).
 * Must not import HTTP, React, or DB drivers.
 */

export type {
  AlcoholGroupMark,
  HomeRecommendation,
  IngredientNode,
  IngredientRole,
  MarkedRecipe,
  RecipeDemand,
  RecipeInput,
  ScoredRecipe,
  SortMode,
  StapleSetting,
} from "./types.js";

export { buildOwnedIds, buildSatisfiedIds } from "./owned.js";
export { computeMissingCount } from "./missing.js";
export {
  collectOwnedAlcoholGroupIds,
  markOwnedAlcoholGroups,
  matchesAlcoholFilter,
  matchesFamilyFlavor,
  matchesNameQuery,
  scoreRecipe,
} from "./filters.js";
export { fillResults, sortRecipes } from "./fill-sort.js";
export {
  markInListRecommendations,
  pickHomeRecommendations,
} from "./recommend.js";
export { applyDeterministicUnits, convertToMilliliters } from "./units.js";
export type { AiIngredientDraft, VolumeConvertResult } from "./units.js";
export {
  applyDeterministicMappings,
  buildIngredientMatchIndex,
  matchGlassware,
  matchGarnishItem,
  matchIngredientName,
  normalizeIngredientLabel,
} from "./ingredient-match.js";
export type {
  GlasswareEnumEntry,
  IngredientCatalogEntry,
  IngredientMatchHit,
  IngredientMatchIndex,
  MatchMethod,
} from "./ingredient-match.js";
export { DEFAULT_BRAND_ALIASES } from "./brand-aliases.js";
export { DEFAULT_GLASSWARE_ENUM } from "./glassware-enum.js";
export {
  AI_CANDIDATE_CONFIDENCE_PRESELECT,
  AI_CANDIDATE_MAX,
  applyCandidatePreselect,
  sanitizeAiCandidates,
  sanitizeTaxonomySuggestion,
} from "./ai-candidates.js";
export type { AiCandidate } from "./ai-candidates.js";
