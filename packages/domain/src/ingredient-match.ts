/** Deterministic ingredient / glassware / garnish mapping for AI import (P-AI2). */

export type MatchMethod = "exact_name" | "alias" | "brand_alias";

export type IngredientMatchHit = {
  ingredientId: string;
  method: MatchMethod;
};

export type IngredientCatalogEntry = {
  id: string;
  nameZh: string;
  nameEn: string;
  aliases: readonly string[];
  parentIngredientId: string | null;
};

export type GlasswareEnumEntry = {
  id: string;
  label: string;
};

export type IngredientMatchIndex = {
  byLabel: Map<string, IngredientMatchHit>;
};

/** ASCII-ish normalize: case, spaces, punctuation, diacritics, parentheses → spaces. */
export function normalizeIngredientLabel(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[（(]/g, " ")
    .replace(/[）)]/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildIngredientMatchIndex(input: {
  ingredients: readonly IngredientCatalogEntry[];
  brandAliases: Readonly<Record<string, string>>;
}): IngredientMatchIndex {
  const byLabel = new Map<string, IngredientMatchHit>();

  const put = (label: string, hit: IngredientMatchHit) => {
    const key = normalizeIngredientLabel(label);
    if (!key || byLabel.has(key)) return;
    byLabel.set(key, hit);
  };

  // Standard names first (includes hierarchy children as their own exact ids).
  for (const ing of input.ingredients) {
    put(ing.nameEn, { ingredientId: ing.id, method: "exact_name" });
    put(ing.nameZh, { ingredientId: ing.id, method: "exact_name" });
  }
  for (const ing of input.ingredients) {
    for (const alias of ing.aliases) {
      put(alias, { ingredientId: ing.id, method: "alias" });
    }
  }
  // Brand aliases last among writers but skip if label already taken —
  // never override a standard name with a brand shortcut.
  for (const [brand, ingredientId] of Object.entries(input.brandAliases)) {
    put(brand, { ingredientId, method: "brand_alias" });
  }

  return { byLabel };
}

export function matchIngredientName(
  rawName: string,
  index: IngredientMatchIndex,
): IngredientMatchHit | null {
  const key = normalizeIngredientLabel(rawName);
  if (!key) return null;
  return index.byLabel.get(key) ?? null;
}

export function matchGlassware(
  rawText: string,
  glasswareEnum: readonly GlasswareEnumEntry[],
): { mapped_id: string | null; raw_text: string; pending: boolean } {
  const raw = rawText.trim();
  if (!raw) {
    return { mapped_id: null, raw_text: "", pending: false };
  }
  const key = normalizeIngredientLabel(raw);
  // Prefer longest matching label to avoid weak short hits.
  let best: { id: string; len: number } | null = null;
  for (const entry of glasswareEnum) {
    const labelKey = normalizeIngredientLabel(entry.label);
    if (!labelKey) continue;
    if (key === labelKey || key === `${labelKey} glass`) {
      if (!best || labelKey.length > best.len) {
        best = { id: entry.id, len: labelKey.length };
      }
      continue;
    }
    if (labelKey.length >= 5 && key.includes(labelKey)) {
      if (!best || labelKey.length > best.len) {
        best = { id: entry.id, len: labelKey.length };
      }
    }
  }
  if (best) {
    return { mapped_id: best.id, raw_text: raw, pending: false };
  }
  return { mapped_id: null, raw_text: raw, pending: true };
}

export function matchGarnishItem(
  rawText: string,
  index: IngredientMatchIndex,
): { raw_text: string; mapped_id: string | null; uncertain: boolean } {
  const raw = rawText.trim();
  if (!raw) {
    return { raw_text: "", mapped_id: null, uncertain: false };
  }
  const hit = matchIngredientName(raw, index);
  if (hit) {
    return { raw_text: raw, mapped_id: hit.ingredientId, uncertain: false };
  }
  return { raw_text: raw, mapped_id: null, uncertain: true };
}

type MappableIngredient = {
  raw_name: string;
  mapping: {
    ingredientId?: string | null;
    method?: string | null;
    candidates?: unknown;
  } | null;
  uncertain: boolean;
};

type MappableDraft = {
  ingredients: MappableIngredient[];
  glassware: {
    mapped_id: string | null;
    raw_text: string;
    pending?: boolean;
  };
  garnish: {
    raw_text: string;
    uncertain: boolean;
    mapped_id?: string | null;
  }[];
  uncertain_fields: string[];
};

export function applyDeterministicMappings<T extends MappableDraft>(
  draft: T,
  opts: {
    index: IngredientMatchIndex;
    glasswareEnum: readonly GlasswareEnumEntry[];
  },
): T {
  const uncertain_fields = new Set(draft.uncertain_fields);

  const ingredients = draft.ingredients.map((ing, i) => {
    const hit = matchIngredientName(ing.raw_name, opts.index);
    if (hit) {
      return {
        ...ing,
        mapping: {
          ingredientId: hit.ingredientId,
          method: hit.method,
          candidates: [],
        },
      };
    }
    uncertain_fields.add(`ingredients[${i}].mapping`);
    return {
      ...ing,
      uncertain: true,
      mapping: {
        ingredientId: null,
        method: null,
        candidates: [],
      },
    };
  });

  const glassware = matchGlassware(
    draft.glassware.raw_text,
    opts.glasswareEnum,
  );
  if (glassware.pending && glassware.raw_text) {
    uncertain_fields.add("glassware");
  }

  const garnish = draft.garnish.map((g, i) => {
    const mapped = matchGarnishItem(g.raw_text, opts.index);
    if (mapped.uncertain && mapped.raw_text) {
      uncertain_fields.add(`garnish[${i}]`);
    }
    return mapped;
  });

  return {
    ...draft,
    ingredients,
    glassware,
    garnish,
    uncertain_fields: [...uncertain_fields],
  };
}
