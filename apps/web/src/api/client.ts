export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      res.status,
      (data as { error?: string }).error ?? res.statusText,
      (data as { details?: unknown }).details,
    );
  }
  return data as T;
}

export type AlcoholGroup = {
  id: string;
  nameZh: string;
  nameEn: string;
  owned: boolean;
};

export type RecipeCard = {
  id: string;
  nameZh: string;
  nameEn: string;
  placeholderImageUrl: string;
  family: { id: string; nameZh: string; nameEn: string } | null;
  flavors: { id: string; nameZh: string; nameEn: string }[];
  missingCount: number;
  materialStatus: string;
  recommended: boolean;
};

export const api = {
  alcoholGroups: () =>
    request<{ items: AlcoholGroup[] }>("/api/alcohol-groups"),
  searchRecipes: (qs: string) =>
    request<{ items: RecipeCard[]; recommendedIds: string[] }>(
      `/api/recipes/search?${qs}`,
    ),
  recipe: (id: string) => request<RecipeDetail>(`/api/recipes/${id}`),
  homeRecommendations: () =>
    request<{
      items: {
        id: string;
        nameZh: string;
        nameEn: string;
        missingCount: number;
        completenessKnown: boolean;
        statusLabel?: string;
      }[];
    }>("/api/recommendations/home"),
  inventory: () =>
    request<{ items: { id: string; ingredientId: string }[] }>("/api/inventory"),
  addInventory: (ingredientId: string) =>
    request("/api/inventory", {
      method: "POST",
      body: JSON.stringify({ ingredientId }),
    }),
  removeInventory: (ingredientId: string) =>
    request(`/api/inventory/${ingredientId}`, { method: "DELETE" }),
  staples: () =>
    request<{
      items: {
        ingredientId: string;
        nameZh: string;
        nameEn: string;
        enabled: boolean;
      }[];
    }>("/api/staples"),
  setStaple: (ingredientId: string, enabled: boolean) =>
    request(`/api/staples/${ingredientId}`, {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    }),
  shopping: () =>
    request<{ items: { id: string; ingredientId: string }[] }>(
      "/api/shopping-items",
    ),
  addShopping: (ingredientId: string) =>
    request("/api/shopping-items", {
      method: "POST",
      body: JSON.stringify({ ingredientId }),
    }),
  removeShopping: (ingredientId: string) =>
    request(`/api/shopping-items/${ingredientId}`, { method: "DELETE" }),
  purchase: (ingredientId: string) =>
    request(`/api/shopping-items/${ingredientId}/purchase`, { method: "POST" }),
  ingredients: (q?: string, categoryId?: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (categoryId) params.set("categoryId", categoryId);
    const qs = params.toString();
    return request<{
      items: IngredientRow[];
      categories: { id: string; nameZh: string; nameEn: string }[];
    }>(`/api/ingredients${qs ? `?${qs}` : ""}`);
  },
  adminRecipes: () =>
    request<{
      items: {
        id: string;
        nameZh: string;
        nameEn: string;
        status: string;
        familyId: string;
        primaryVersionId: string | null;
        editorRecommended: number;
        recommendationOrder: number | null;
      }[];
    }>("/api/admin/recipes"),
  adminRecipe: (id: string) =>
    request<{
      id: string;
      nameZh: string;
      nameEn: string;
      familyId: string;
      status: string;
      ibaCategory: string | null;
      editorRecommended: boolean;
      recommendationOrder: number | null;
      primaryVersionId: string | null;
      flavorTagIds: string[];
      version: {
        id: string;
        versionName: string;
        sourceName: string;
        glassware: string | null;
        garnish: string | null;
        steps: string[];
        ingredients: {
          ingredientId: string;
          amountMl: number | null;
          role: string;
          eitherGroupId: string | null;
        }[];
      } | null;
    }>(`/api/admin/recipes/${id}`),
  createRecipe: (body: unknown) =>
    request<{ id: string }>("/api/admin/recipes", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateRecipe: (id: string, body: unknown) =>
    request(`/api/admin/recipes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteRecipe: (id: string) =>
    request(`/api/admin/recipes/${id}`, { method: "DELETE" }),
  createVersion: (recipeId: string, body: unknown) =>
    request<{ id: string }>(`/api/admin/recipes/${recipeId}/versions`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  setPrimary: (recipeId: string, versionId: string) =>
    request(`/api/admin/recipes/${recipeId}/primary-version`, {
      method: "PUT",
      body: JSON.stringify({ versionId }),
    }),
  publish: (recipeId: string, status: "draft" | "published") =>
    request(`/api/admin/recipes/${recipeId}/publish`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  adminAlcoholGroups: () =>
    request<{
      items: { id: string; nameZh: string; nameEn: string }[];
    }>("/api/admin/alcohol-groups"),
  adminIngredients: () =>
    request<{
      items: IngredientRow[];
    }>("/api/admin/ingredients"),
  createIngredient: (body: unknown) =>
    request<{ id: string }>("/api/admin/ingredients", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  patchIngredient: (id: string, body: unknown) =>
    request<IngredientRow>(`/api/admin/ingredients/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteIngredient: (id: string) =>
    request(`/api/admin/ingredients/${id}`, { method: "DELETE" }),
  families: () =>
    request<{
      items: { id: string; nameZh: string; nameEn: string; active: number }[];
    }>("/api/admin/families"),
  flavors: () =>
    request<{
      items: { id: string; nameZh: string; nameEn: string; active: number }[];
    }>("/api/admin/flavors"),
  patchFamily: (id: string, body: unknown) =>
    request(`/api/admin/families/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  patchFlavor: (id: string, body: unknown) =>
    request(`/api/admin/flavors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  adminLogin: (password: string) =>
    request<{ ok: boolean; authenticated: boolean }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  adminLogout: () =>
    request<{ ok: boolean; authenticated: boolean }>("/api/admin/logout", {
      method: "POST",
    }),
  adminSession: () =>
    request<{ authenticated: boolean }>("/api/admin/session"),
  aiStatus: () =>
    request<{
      configured: boolean;
      available: boolean;
      model: string | null;
      provider: string | null;
    }>("/api/ai/status"),
  aiChat: (body: {
    message: string;
    history?: { role: "user" | "assistant"; content: string }[];
  }) =>
    request<
      | {
          kind: "reply";
          assistantMessage: string;
          canSave: false;
          savePath: null;
        }
      | {
          kind: "library";
          assistantMessage: string;
          recipes: {
            id: string;
            nameZh: string;
            nameEn: string;
            missingCount: number;
            matchReason: string;
            detailPath: string;
          }[];
          canSave: false;
          savePath: null;
        }
      | {
          kind: "generated";
          assistantMessage: string;
          disclaimer: string;
          text: string;
          title: string;
          canSave: false;
          savePath: null;
        }
    >("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  aiImportParse: (body: {
    sourceText: string;
    sourceName: string;
    sourceUrl?: string | null;
  }) =>
    request<{ draft: AiParsedRecipe; taxonomyReason: string | null }>(
      "/api/admin/ai-import/parse",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
  aiImportReparse: (body: {
    sourceText: string;
    sourceName: string;
    sourceUrl?: string | null;
    previous?: AiParsedRecipe;
    instruction?: string;
  }) =>
    request<{
      draft: AiParsedRecipe;
      previous: AiParsedRecipe | null;
      diff: { changedPaths: string[] };
      taxonomyReason: string | null;
    }>("/api/admin/ai-import/reparse", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  aiImportCommit: (body: unknown) =>
    request<{ id: string; versionId: string; status: string }>(
      "/api/admin/ai-import/commit",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
};

export type AiParsedIngredient = {
  raw_name: string;
  raw_amount: string;
  raw_unit: string;
  amount_ml: number | null;
  estimated_amount_ml: number | null;
  role: "required" | "optional" | "garnish" | "either";
  either_group: string | null;
  mapping: {
    ingredientId?: string | null;
    method?: string | null;
    candidates?: {
      ingredientId: string;
      nameZh?: string;
      nameEn?: string;
      reason?: string;
      confidence?: number;
    }[];
    preselected?: boolean;
  } | null;
  uncertain: boolean;
};

export type AiParsedRecipe = {
  name_zh: string;
  name_en: string;
  source: { name: string; url: string | null };
  ingredients: AiParsedIngredient[];
  glassware: {
    mapped_id: string | null;
    raw_text: string;
    pending?: boolean;
  };
  garnish: {
    raw_text: string;
    mapped_id?: string | null;
    uncertain: boolean;
  }[];
  steps: string[];
  notes: string | null;
  suggested_family_id: string | null;
  suggested_flavor_ids: string[];
  uncertain_fields: string[];
};

export type IngredientRow = {
  id: string;
  nameZh: string;
  nameEn: string;
  categoryId: string;
  parentIngredientId: string | null;
  alcoholGroupId: string | null;
  canBeStaple: number;
  active: number;
};

export type RecipeDetail = {
  id: string;
  nameZh: string;
  nameEn: string;
  ibaCategory: string | null;
  family: { id: string; nameZh: string; nameEn: string } | null;
  flavors: ({ id: string; nameZh: string; nameEn: string } | undefined)[];
  placeholderImageUrl: string;
  missingCount: number;
  version: {
    id: string;
    versionName: string;
    sourceName: string;
    sourceRevision: string | null;
    glassware: string | null;
    garnish: string | null;
    steps: string[];
    ingredients: {
      ingredientId: string;
      amountMl: number | null;
      role: string;
      owned: boolean;
      inShopping: boolean;
      displayNote: string | null;
      nameZh: string;
    }[];
  };
};
