/** User-facing labels. Keep implementation jargon out of the UI. */

export const INGREDIENT_ROLE_LABELS: Record<string, string> = {
  required: "必需",
  optional: "可选",
  garnish: "装饰",
  either: "二选一",
};

export function ingredientRoleLabel(role: string): string {
  return INGREDIENT_ROLE_LABELS[role] ?? role;
}

const MAPPING_METHOD_LABELS: Record<string, string> = {
  exact_name: "名称一致",
  alias: "别名",
  brand_alias: "品牌别名",
  ai_candidate: "AI 建议",
};

export function mappingMethodLabel(method: string | null | undefined): string {
  if (!method) return "还没对上";
  return MAPPING_METHOD_LABELS[method] ?? method;
}
