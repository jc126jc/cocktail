import { z } from "zod";
import type { AppDatabase } from "@cocktail/db";
import * as schema from "@cocktail/db/schema";
import {
  applyCandidatePreselect,
  sanitizeAiCandidates,
  sanitizeTaxonomySuggestion,
} from "@cocktail/domain";
import type { AiParsedRecipe } from "@cocktail/shared";
import { badRequest } from "../../http.js";
import type { LlmProvider } from "./provider.js";
import { loadIngredientCatalog } from "./catalog-map.js";

const enrichResponseSchema = z.object({
  mappings: z
    .array(
      z.object({
        index: z.number().int().nonnegative(),
        candidates: z
          .array(
            z.object({
              ingredientId: z.string(),
              reason: z.string().optional(),
              confidence: z.number().optional(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
  suggested_family_id: z.string().nullable().optional(),
  suggested_flavor_ids: z.array(z.string()).optional(),
  taxonomy_reason: z.string().optional(),
});

const ENRICH_SYSTEM = `You help map unmatched cocktail ingredient names to an existing standard ingredient catalog, and suggest cocktail family / flavor tags.
Rules:
- Only use ingredientId values from the provided catalog. Never invent ids.
- For each unmatched item, return at most 3 candidates with reason and confidence 0–1.
- Brand vs generic category: do not treat them as equivalent unless clearly the same catalog entry.
- Family and flavor ids must come from the provided lists; omit if unsure.
- Do not create new ingredients or parent/child links.
- JSON only.`;

export async function enrichDraftWithAi(input: {
  llm: LlmProvider;
  db: AppDatabase;
  draft: AiParsedRecipe;
  sourceText: string;
}): Promise<{ draft: AiParsedRecipe; taxonomyReason: string | null }> {
  const catalog = loadIngredientCatalog(input.db);
  const allowedIngredientIds = new Set(catalog.map((c) => c.id));
  const families = input.db.select().from(schema.cocktailFamilies).all();
  const flavors = input.db.select().from(schema.flavorTags).all();
  const familyIds = new Set(
    families.filter((f) => f.active === 1).map((f) => f.id),
  );
  const flavorIds = new Set(
    flavors.filter((f) => f.active === 1).map((f) => f.id),
  );

  let draft: AiParsedRecipe = {
    ...input.draft,
    ...sanitizeTaxonomySuggestion(
      {
        suggested_family_id: input.draft.suggested_family_id,
        suggested_flavor_ids: input.draft.suggested_flavor_ids,
      },
      { familyIds, flavorIds },
    ),
  };

  const unmatched = draft.ingredients
    .map((ing, index) => ({ ing, index }))
    .filter(({ ing }) => !ing.mapping?.ingredientId);

  if (unmatched.length === 0 || !input.llm.isConfigured()) {
    return { draft, taxonomyReason: null };
  }

  const user = JSON.stringify(
    {
      sourceText: input.sourceText.slice(0, 4000),
      recipe: {
        name_zh: draft.name_zh,
        name_en: draft.name_en,
        steps: draft.steps,
      },
      unmatched: unmatched.map(({ ing, index }) => ({
        index,
        raw_name: ing.raw_name,
        role: ing.role,
      })),
      catalog: catalog.map((c) => ({
        id: c.id,
        nameZh: c.nameZh,
        nameEn: c.nameEn,
      })),
      families: families
        .filter((f) => f.active === 1)
        .map((f) => ({ id: f.id, nameZh: f.nameZh })),
      flavors: flavors
        .filter((f) => f.active === 1)
        .map((f) => ({ id: f.id, nameZh: f.nameZh })),
      responseShape: {
        mappings: [
          {
            index: 0,
            candidates: [{ ingredientId: "id", reason: "", confidence: 0.0 }],
          },
        ],
        suggested_family_id: null,
        suggested_flavor_ids: [],
        taxonomy_reason: "",
      },
    },
    null,
    2,
  );

  let raw: unknown;
  try {
    raw = await input.llm.completeJson({
      system: ENRICH_SYSTEM,
      user,
    });
  } catch {
    return { draft, taxonomyReason: null };
  }

  let enrich;
  try {
    enrich = enrichResponseSchema.parse(raw);
  } catch (e) {
    throw badRequest("AI 候选/分类输出未通过校验", e);
  }

  const byIndex = new Map(enrich.mappings.map((m) => [m.index, m.candidates]));
  const ingredients = draft.ingredients.map((ing, index) => {
    if (ing.mapping?.ingredientId) return ing;
    const rawCandidates = byIndex.get(index) ?? [];
    const candidates = sanitizeAiCandidates(
      rawCandidates,
      allowedIngredientIds,
    );
    const { ingredientId, preselected } = applyCandidatePreselect(candidates);
    return {
      ...ing,
      uncertain: true,
      mapping: {
        ingredientId,
        method: ingredientId ? ("ai_candidate" as const) : null,
        candidates: candidates.map((c) => ({
          ingredientId: c.ingredientId,
          reason: c.reason,
          confidence: c.confidence,
          nameZh: catalog.find((x) => x.id === c.ingredientId)?.nameZh,
          nameEn: catalog.find((x) => x.id === c.ingredientId)?.nameEn,
        })),
        preselected,
      },
    };
  });

  const taxonomy = sanitizeTaxonomySuggestion(
    {
      suggested_family_id:
        enrich.suggested_family_id ?? draft.suggested_family_id,
      suggested_flavor_ids:
        enrich.suggested_flavor_ids ?? draft.suggested_flavor_ids,
    },
    { familyIds, flavorIds },
  );

  draft = {
    ...draft,
    ingredients,
    ...taxonomy,
  };

  return {
    draft,
    taxonomyReason: enrich.taxonomy_reason?.trim() || null,
  };
}
