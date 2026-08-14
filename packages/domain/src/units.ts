/** Deterministic volume conversion for AI import (FR-21 / P-AI1). */

export type VolumeConvertResult =
  | { kind: "exact"; amountMl: number }
  | { kind: "needs_estimate" }
  | { kind: "empty" };

const ML_PER_OZ = 29.5735;

const EXACT_UNIT_FACTOR: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  millilitre: 1,
  millilitres: 1,
  毫升: 1,
  cl: 10,
  centiliter: 10,
  centiliters: 10,
  centilitre: 10,
  centilitres: 10,
  厘升: 10,
  oz: ML_PER_OZ,
  "fl oz": ML_PER_OZ,
  floz: ML_PER_OZ,
  "fluid ounce": ML_PER_OZ,
  "fluid ounces": ML_PER_OZ,
  ounce: ML_PER_OZ,
  ounces: ML_PER_OZ,
  盎司: ML_PER_OZ,
};

function normalizeUnit(unit: string | null | undefined): string {
  return (unit ?? "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

export function convertToMilliliters(input: {
  amount: number | null | undefined;
  unit: string | null | undefined;
}): VolumeConvertResult {
  const unit = normalizeUnit(input.unit);
  if (!unit && (input.amount == null || Number.isNaN(input.amount))) {
    return { kind: "empty" };
  }
  const factor = EXACT_UNIT_FACTOR[unit];
  if (factor != null) {
    if (input.amount == null || Number.isNaN(Number(input.amount))) {
      return { kind: "needs_estimate" };
    }
    return { kind: "exact", amountMl: Number(input.amount) * factor };
  }
  return { kind: "needs_estimate" };
}

export type AiIngredientDraft = {
  raw_name: string;
  raw_amount: string;
  raw_unit: string;
  amount_ml: number | null;
  estimated_amount_ml: number | null;
  role: string;
  either_group: string | null;
  mapping: unknown;
  uncertain: boolean;
};

export function applyDeterministicUnits<T extends { ingredients: AiIngredientDraft[] }>(
  draft: T,
): T {
  return {
    ...draft,
    ingredients: draft.ingredients.map((ing) => {
      const amountNum = parseLooseAmount(ing.raw_amount);
      const result = convertToMilliliters({
        amount: amountNum,
        unit: ing.raw_unit,
      });
      if (result.kind === "exact") {
        return {
          ...ing,
          amount_ml: roundMl(result.amountMl),
          estimated_amount_ml: null,
        };
      }
      return {
        ...ing,
        amount_ml: null,
        estimated_amount_ml:
          ing.estimated_amount_ml != null && !Number.isNaN(ing.estimated_amount_ml)
            ? ing.estimated_amount_ml
            : null,
      };
    }),
  };
}

function parseLooseAmount(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return Number(m[1]);
}

function roundMl(n: number): number {
  return Math.round(n * 10000) / 10000;
}
