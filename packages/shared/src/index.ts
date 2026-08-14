import { z } from "zod";

export const recipeStatusSchema = z.enum(["draft", "published"]);
export type RecipeStatus = z.infer<typeof recipeStatusSchema>;

export const recipeIngredientRoleSchema = z.enum([
  "required",
  "optional",
  "garnish",
  "either",
]);
export type RecipeIngredientRole = z.infer<typeof recipeIngredientRoleSchema>;

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("cocktail-api"),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const sortModeSchema = z.enum(["completeness", "name", "random"]);

export const recipeSearchQuerySchema = z.object({
  q: z.string().optional().default(""),
  alcoholGroupIds: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : []))
    .pipe(z.array(z.string()).max(2)),
  familyIds: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : [])),
  flavorIds: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : [])),
  sort: sortModeSchema.default("completeness"),
  randomSeed: z.string().optional(),
});

export const ingredientIdBodySchema = z.object({
  ingredientId: z.string().min(1),
});

export const staplePutBodySchema = z.object({
  enabled: z.boolean(),
});

export const errorBodySchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});

export const publishRecipeBodySchema = z.object({
  status: recipeStatusSchema,
});

export const setPrimaryVersionBodySchema = z.object({
  versionId: z.string().min(1),
});

export const createRecipeBodySchema = z.object({
  id: z.string().min(1).optional(),
  nameZh: z.string().min(1),
  nameEn: z.string().min(1),
  familyId: z.string().min(1),
  flavorTagIds: z.array(z.string()).default([]),
  editorRecommended: z.boolean().optional(),
  recommendationOrder: z.number().int().nullable().optional(),
  status: recipeStatusSchema.default("draft"),
  ibaCategory: z.string().nullable().optional(),
});

export const updateRecipeBodySchema = createRecipeBodySchema.partial();

export const createVersionBodySchema = z.object({
  id: z.string().min(1).optional(),
  versionName: z.string().min(1),
  sourceName: z.string().min(1),
  sourceUrl: z.string().nullable().optional(),
  sourceRevision: z.string().nullable().optional(),
  glassware: z.string().nullable().optional(),
  garnish: z.string().nullable().optional(),
  steps: z.array(z.string()).default([]),
  ingredients: z
    .array(
      z.object({
        ingredientId: z.string().min(1),
        amountMl: z.number().nullable().optional(),
        role: recipeIngredientRoleSchema,
        eitherGroupId: z.string().nullable().optional(),
        displayNote: z.string().nullable().optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .default([]),
});

export const createIngredientBodySchema = z.object({
  id: z.string().min(1).optional(),
  nameZh: z.string().min(1),
  nameEn: z.string().min(1),
  categoryId: z.string().min(1),
  parentIngredientId: z.string().nullable().optional(),
  alcoholGroupId: z.string().nullable().optional(),
  canBeStaple: z.boolean().optional(),
  aliases: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export const updateIngredientBodySchema = createIngredientBodySchema.partial();

export const updateTaxonomyBodySchema = z.object({
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  nameZh: z.string().min(1).optional(),
  nameEn: z.string().min(1).optional(),
});

export const adminLoginBodySchema = z.object({
  password: z.string().min(1),
});

export const aiChatBodySchema = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .max(40)
    .default([]),
});

export const aiIngredientRoleSchema = recipeIngredientRoleSchema;

export const aiParsedIngredientSchema = z.object({
  raw_name: z.string(),
  raw_amount: z.string().default(""),
  raw_unit: z.string().default(""),
  amount_ml: z.number().nullable().default(null),
  estimated_amount_ml: z.number().nullable().default(null),
  role: aiIngredientRoleSchema,
  either_group: z.string().nullable().default(null),
  mapping: z
    .object({
      ingredientId: z.string().nullable().optional(),
      method: z
        .enum(["exact_name", "alias", "brand_alias", "ai_candidate"])
        .nullable()
        .optional(),
      candidates: z
        .array(
          z.object({
            ingredientId: z.string(),
            nameZh: z.string().optional(),
            nameEn: z.string().optional(),
            reason: z.string().optional(),
            confidence: z.number().optional(),
          }),
        )
        .optional(),
      preselected: z.boolean().optional(),
    })
    .nullable()
    .default(null),
  uncertain: z.boolean().default(false),
});

export const aiParsedRecipeSchema = z.object({
  name_zh: z.string(),
  name_en: z.string(),
  source: z.object({
    name: z.string().default(""),
    url: z.string().nullable().default(null),
  }),
  ingredients: z.array(aiParsedIngredientSchema).default([]),
  glassware: z
    .object({
      mapped_id: z.string().nullable().default(null),
      raw_text: z.string().default(""),
      pending: z.boolean().optional().default(false),
    })
    .default({ mapped_id: null, raw_text: "", pending: false }),
  garnish: z
    .array(
      z.object({
        raw_text: z.string(),
        mapped_id: z.string().nullable().optional().default(null),
        uncertain: z.boolean().default(false),
      }),
    )
    .default([]),
  steps: z.array(z.string()).default([]),
  notes: z.string().nullable().default(null),
  suggested_family_id: z.string().nullable().default(null),
  suggested_flavor_ids: z.array(z.string()).default([]),
  uncertain_fields: z.array(z.string()).default([]),
});

export type AiParsedRecipe = z.infer<typeof aiParsedRecipeSchema>;

export const aiImportParseBodySchema = z.object({
  sourceText: z.string().min(1).max(10_000),
  sourceName: z.string().min(1),
  sourceUrl: z.string().nullable().optional(),
});

export const aiImportReparseBodySchema = aiImportParseBodySchema.extend({
  previous: aiParsedRecipeSchema.optional(),
  instruction: z.string().max(2000).optional(),
});

export const aiImportCommitBodySchema = z.object({
  draft: aiParsedRecipeSchema,
  familyId: z.string().min(1).default("other"),
  flavorTagIds: z.array(z.string()).default([]),
  ingredients: z
    .array(
      z.object({
        ingredientId: z.string().min(1),
        amountMl: z.number().nullable().optional(),
        role: recipeIngredientRoleSchema,
        eitherGroupId: z.string().nullable().optional(),
        displayNote: z.string().nullable().optional(),
      }),
    )
    .min(1),
  glassware: z.string().nullable().optional(),
  garnish: z.string().nullable().optional(),
  steps: z.array(z.string()).default([]),
  nameZh: z.string().min(1),
  nameEn: z.string().min(1),
  sourceName: z.string().min(1),
  sourceUrl: z.string().nullable().optional(),
});

export function diffAiParsedRecipes(
  before: AiParsedRecipe,
  after: AiParsedRecipe,
): { changedPaths: string[] } {
  const changedPaths: string[] = [];
  const topKeys: (keyof AiParsedRecipe)[] = [
    "name_zh",
    "name_en",
    "notes",
    "suggested_family_id",
  ];
  for (const key of topKeys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changedPaths.push(key);
    }
  }
  if (JSON.stringify(before.source) !== JSON.stringify(after.source)) {
    changedPaths.push("source");
  }
  if (JSON.stringify(before.glassware) !== JSON.stringify(after.glassware)) {
    changedPaths.push("glassware");
  }
  if (JSON.stringify(before.garnish) !== JSON.stringify(after.garnish)) {
    changedPaths.push("garnish");
  }
  if (JSON.stringify(before.steps) !== JSON.stringify(after.steps)) {
    changedPaths.push("steps");
  }
  if (
    JSON.stringify(before.suggested_flavor_ids) !==
    JSON.stringify(after.suggested_flavor_ids)
  ) {
    changedPaths.push("suggested_flavor_ids");
  }
  if (
    JSON.stringify(before.uncertain_fields) !==
    JSON.stringify(after.uncertain_fields)
  ) {
    changedPaths.push("uncertain_fields");
  }

  const max = Math.max(before.ingredients.length, after.ingredients.length);
  for (let i = 0; i < max; i++) {
    const a = before.ingredients[i];
    const b = after.ingredients[i];
    if (!a || !b) {
      changedPaths.push(`ingredients[${i}]`);
      continue;
    }
    for (const field of [
      "raw_name",
      "raw_amount",
      "raw_unit",
      "amount_ml",
      "estimated_amount_ml",
      "role",
      "either_group",
      "uncertain",
    ] as const) {
      if (a[field] !== b[field]) {
        changedPaths.push(`ingredients[${i}].${field}`);
      }
    }
  }
  return { changedPaths };
}
