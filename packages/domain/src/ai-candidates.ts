/** AI candidate sanitization for import enrich (P-AI3). Pure — no LLM. */

export const AI_CANDIDATE_MAX = 3;
export const AI_CANDIDATE_CONFIDENCE_PRESELECT = 0.8;

export type AiCandidate = {
  ingredientId: string;
  reason: string;
  confidence: number;
};

export function sanitizeAiCandidates(
  raw: readonly {
    ingredientId?: string;
    reason?: string;
    confidence?: number;
  }[],
  allowedIds: ReadonlySet<string>,
): AiCandidate[] {
  const seen = new Set<string>();
  const cleaned: AiCandidate[] = [];
  for (const row of raw) {
    const id = (row.ingredientId ?? "").trim();
    if (!id || !allowedIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    const confidence = clamp01(Number(row.confidence));
    cleaned.push({
      ingredientId: id,
      reason: (row.reason ?? "").trim() || "AI candidate",
      confidence: Number.isFinite(confidence) ? confidence : 0,
    });
  }
  cleaned.sort((a, b) => b.confidence - a.confidence);
  return cleaned.slice(0, AI_CANDIDATE_MAX);
}

export function applyCandidatePreselect(candidates: readonly AiCandidate[]): {
  ingredientId: string | null;
  preselected: boolean;
} {
  const top = candidates[0];
  if (top && top.confidence >= AI_CANDIDATE_CONFIDENCE_PRESELECT) {
    return { ingredientId: top.ingredientId, preselected: true };
  }
  return { ingredientId: null, preselected: false };
}

export function sanitizeTaxonomySuggestion(
  input: {
    suggested_family_id: string | null;
    suggested_flavor_ids: readonly string[];
  },
  allowed: {
    familyIds: ReadonlySet<string>;
    flavorIds: ReadonlySet<string>;
  },
): {
  suggested_family_id: string | null;
  suggested_flavor_ids: string[];
} {
  const family =
    input.suggested_family_id && allowed.familyIds.has(input.suggested_family_id)
      ? input.suggested_family_id
      : null;
  const flavors: string[] = [];
  const seen = new Set<string>();
  for (const id of input.suggested_flavor_ids) {
    if (!allowed.flavorIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    flavors.push(id);
  }
  return { suggested_family_id: family, suggested_flavor_ids: flavors };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
