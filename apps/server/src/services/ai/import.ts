import {
  aiParsedRecipeSchema,
  diffAiParsedRecipes,
  type AiParsedRecipe,
} from "@cocktail/shared";
import { applyDeterministicUnits } from "@cocktail/domain";
import type { AppDatabase } from "@cocktail/db";
import { badRequest, serviceUnavailable } from "../../http.js";
import {
  createRecipe,
  createVersion,
  setPrimaryVersion,
} from "../admin.js";
import type { LlmProvider } from "./provider.js";
import { applyCatalogMappings } from "./catalog-map.js";
import { enrichDraftWithAi } from "./enrich.js";

const PARSE_SYSTEM = `You extract cocktail recipe text into JSON only.
Rules:
- Output a single JSON object matching the required schema keys.
- Never invent a recipe from empty context; only extract from the given source text.
- Roles must be one of: required, optional, garnish, either.
- If a role is unclear, set uncertain=true for that ingredient and add the field path to uncertain_fields; do not silently default everything to required.
- For either-or groups, set role=either and the same either_group string on each alternative.
- Convert nothing yourself for oz/cl/ml — leave amount_ml null for the server; you may set estimated_amount_ml only for non-volume units (dash, piece, to taste, etc.) and mark uncertain.
- English source: fill name_zh with a Chinese translation draft.
- Chinese source: fill name_en with an English translation draft when possible.
- glassware.raw_text and garnish[].raw_text from the text; mapped_id null.
- Do not invent IBA/classic authority claims beyond what the text states.
- uncertain_fields lists field paths you could not confirm.`;

function schemaHint(): string {
  return JSON.stringify(
    {
      name_zh: "",
      name_en: "",
      source: { name: "", url: null },
      ingredients: [
        {
          raw_name: "",
          raw_amount: "",
          raw_unit: "",
          amount_ml: null,
          estimated_amount_ml: null,
          role: "required",
          either_group: null,
          mapping: null,
          uncertain: false,
        },
      ],
      glassware: { mapped_id: null, raw_text: "" },
      garnish: [{ raw_text: "", uncertain: false }],
      steps: [],
      notes: null,
      suggested_family_id: null,
      suggested_flavor_ids: [],
      uncertain_fields: [],
    },
    null,
    2,
  );
}

export async function parseRecipeFromText(input: {
  llm: LlmProvider;
  db: AppDatabase;
  sourceText: string;
  sourceName: string;
  sourceUrl?: string | null;
  instruction?: string;
}): Promise<{ draft: AiParsedRecipe; taxonomyReason: string | null }> {
  if (!input.llm.isConfigured()) {
    throw serviceUnavailable(
      "AI 未配置或不可用：请设置 AI_API_KEY，并确保可访问 AI_BASE_URL",
    );
  }

  const user = [
    `Source name: ${input.sourceName}`,
    input.sourceUrl ? `Source URL: ${input.sourceUrl}` : null,
    input.instruction ? `Additional instruction: ${input.instruction}` : null,
    "Schema example:",
    schemaHint(),
    "Recipe text:",
    input.sourceText,
  ]
    .filter(Boolean)
    .join("\n\n");

  const raw = await input.llm.completeJson({
    system: PARSE_SYSTEM,
    user,
  });

  let parsed;
  try {
    parsed = aiParsedRecipeSchema.parse(raw);
  } catch (e) {
    throw badRequest("AI 输出未通过 JSON Schema 校验", e);
  }

  if (!parsed.source.name) {
    parsed = {
      ...parsed,
      source: {
        name: input.sourceName,
        url: input.sourceUrl ?? parsed.source.url,
      },
    };
  }

  const withUnits = applyDeterministicUnits(parsed);
  const mapped = applyCatalogMappings(input.db, withUnits);
  return enrichDraftWithAi({
    llm: input.llm,
    db: input.db,
    draft: mapped,
    sourceText: input.sourceText,
  });
}

export async function reparseRecipeFromText(input: {
  llm: LlmProvider;
  db: AppDatabase;
  sourceText: string;
  sourceName: string;
  sourceUrl?: string | null;
  previous?: AiParsedRecipe;
  instruction?: string;
}) {
  const { draft, taxonomyReason } = await parseRecipeFromText(input);
  const previous = input.previous
    ? aiParsedRecipeSchema.parse(input.previous)
    : null;
  const diff = previous
    ? diffAiParsedRecipes(previous, draft)
    : { changedPaths: [] as string[] };
  return { draft, previous, diff, taxonomyReason };
}

export function commitAiImport(
  db: AppDatabase,
  body: {
    nameZh: string;
    nameEn: string;
    familyId: string;
    flavorTagIds: string[];
    sourceName: string;
    sourceUrl?: string | null;
    glassware?: string | null;
    garnish?: string | null;
    steps: string[];
    ingredients: {
      ingredientId: string;
      amountMl?: number | null;
      role: "required" | "optional" | "garnish" | "either";
      eitherGroupId?: string | null;
      displayNote?: string | null;
    }[];
  },
) {
  const recipe = createRecipe(db, {
    nameZh: body.nameZh,
    nameEn: body.nameEn,
    familyId: body.familyId,
    flavorTagIds: body.flavorTagIds,
    status: "draft",
  });
  const version = createVersion(db, recipe.id, {
    versionName: "imported",
    sourceName: body.sourceName,
    sourceUrl: body.sourceUrl ?? null,
    glassware: body.glassware ?? null,
    garnish: body.garnish ?? null,
    steps: body.steps,
    ingredients: body.ingredients.map((line, index) => ({
      ...line,
      sortOrder: index,
    })),
  });
  setPrimaryVersion(db, recipe.id, version.id);
  return { id: recipe.id, versionId: version.id, status: "draft" as const };
}
