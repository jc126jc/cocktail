import { z } from "zod";
import { badRequest, serviceUnavailable } from "../../http.js";
import type { LlmProvider } from "./provider.js";
import type { AiChatTools, ChatSearchItem } from "./chat-tools.js";

const intentSchema = z.object({
  intent: z.preprocess((value) => {
    if (value == null || value === "") return "non_search";
    const normalized = String(value).trim().toLowerCase().replace(/-/g, "_");
    if (normalized === "search" || normalized === "non_search") return normalized;
    return "non_search";
  }, z.enum(["search", "non_search"])),
  reply: z.string().optional().default(""),
  q: z.string().optional().default(""),
  alcoholGroupIds: z.array(z.string()).default([]),
  familyIds: z.array(z.string()).default([]),
  flavorIds: z.array(z.string()).default([]),
  sort: z
    .enum(["completeness", "name", "random"])
    .optional()
    .default("completeness"),
});

const generatedSchema = z.object({
  title: z.string(),
  body: z.string(),
  ingredientIds: z.array(z.string()).default([]),
});

export type AiChatReplyResult = {
  kind: "reply";
  assistantMessage: string;
  canSave: false;
  savePath: null;
};

export type AiChatLibraryResult = {
  kind: "library";
  assistantMessage: string;
  recipes: ChatSearchItem[];
  canSave: false;
  savePath: null;
};

export type AiChatGeneratedResult = {
  kind: "generated";
  assistantMessage: string;
  disclaimer: string;
  text: string;
  title: string;
  canSave: false;
  savePath: null;
};

export type AiChatResult =
  | AiChatReplyResult
  | AiChatLibraryResult
  | AiChatGeneratedResult;

const DISCLAIMER =
  "这是临时写的，还没核对过。不会用来判断酒柜是否齐全，也不是经典或官方配方。";

const DEFAULT_NON_SEARCH_REPLY =
  "我主要帮你找现成的配方。可以说想用哪类酒、什么口味，或直接报酒名。";

const INTENT_SYSTEM = `Classify the user message for a local cocktail recipe assistant. Output JSON only:
{
  "intent": "search" | "non_search",
  "reply": "",
  "q": "",
  "alcoholGroupIds": [],
  "familyIds": [],
  "flavorIds": [],
  "sort": "completeness"
}
Rules:
- intent=search ONLY when the user clearly wants to find, filter, name, or get recommendations for drinks (e.g. 来一杯金酒的, 有没有内格罗尼, 推荐酸一点的, Negroni, gin sour, 随便推荐一杯).
- intent=non_search for greetings, jokes, banter, off-topic chat, mood talk, or no clear find-drink intent. When unsure, use non_search.
- Examples of non_search: 你好; 1; 嗯; 测试; 尽可能难喝的酒; 讲个笑话; 今天天气怎么样; 随便聊聊.
- Never run an empty-filter catalog dump for unclear messages. Only use empty filters when the user clearly asks for open recommendations (随便推荐一杯 / 来一杯 / 有什么好喝).
- For non_search: fill "reply" with a short helpful Chinese (or user language) message in everyday words (no jargon like 本地库/结构化/AND/入库); do NOT invent recipes; gently guide how to ask for drinks. Leave filters empty.
- For search: leave reply empty; set filters. alcoholGroupIds: 0–2 of gin,whiskey,rum,vodka,tequila,brandy,wine,beer,baijiu. Prefer completeness sort unless user asks name/random. q may be a name substring. Do not invent recipes here.
- Never use empty default search just because the message mentions 酒.`;

/** High-confidence non-search: skip LLM + empty-filter library dump. */
export function isObviousNonSearch(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  if (/^\d+$/.test(t)) return true;
  if (/^[a-zA-Z]$/.test(t)) return true;
  if (/^[\s\p{P}\p{S}]+$/u.test(t)) return true;
  if (
    /^(你好|您好|hello|hi|hey|嗨|在吗|谢谢|多谢|感谢)[\s!！.。？?~～]*$/i.test(t)
  ) {
    return true;
  }
  if (/^(嗯+|啊+|哦+|哈+|呵+|额+|唔+|嘿+|ok|好的?|行|测试)$/i.test(t)) {
    return true;
  }
  if (/尽可能难喝|最难喝|超级难喝|故意难喝/.test(t)) return true;
  if (/今天天气|讲个笑话|你是谁|你叫什么|随便聊聊/.test(t)) return true;
  return false;
}

/** Empty filters are only OK for explicit open recommendations. */
export function isOpenRecommend(message: string): boolean {
  return /随便(推荐|来|喝)|推荐(一杯|几杯|点|一下)|来一杯|有什么(好喝|推荐)|今晚喝什么|给我推荐|帮我挑|不想选/.test(
    message,
  );
}

function hasSearchFilters(intent: {
  q: string;
  alcoholGroupIds: string[];
  familyIds: string[];
  flavorIds: string[];
}): boolean {
  return Boolean(
    intent.q.trim() ||
      intent.alcoholGroupIds.length ||
      intent.familyIds.length ||
      intent.flavorIds.length,
  );
}

function replyResult(message: string): AiChatReplyResult {
  return {
    kind: "reply",
    assistantMessage: message.trim() || DEFAULT_NON_SEARCH_REPLY,
    canSave: false,
    savePath: null,
  };
}

export async function runAiChat(input: {
  llm: LlmProvider;
  tools: AiChatTools;
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  generateTemporary?: (args: {
    message: string;
    inventory: { ingredientId: string; nameZh?: string; nameEn?: string }[];
    catalog: { id: string; nameZh: string; nameEn: string }[];
  }) => Promise<{ title: string; body: string; ingredientIds?: string[] }>;
}): Promise<AiChatResult> {
  if (!input.llm.isConfigured()) {
    throw serviceUnavailable("AI 未配置或不可用");
  }
  const message = input.message.trim();
  if (!message) throw badRequest("消息不能为空");

  if (isObviousNonSearch(message)) {
    return replyResult(DEFAULT_NON_SEARCH_REPLY);
  }

  const intentRaw = await input.llm.completeJson({
    system: INTENT_SYSTEM,
    user: JSON.stringify({
      message,
      history: input.history.slice(-8),
    }),
  });
  const intent = intentSchema.parse(intentRaw);

  if (intent.intent === "non_search") {
    return replyResult(intent.reply || DEFAULT_NON_SEARCH_REPLY);
  }

  if (!hasSearchFilters(intent) && !isOpenRecommend(message)) {
    return replyResult(intent.reply || DEFAULT_NON_SEARCH_REPLY);
  }

  const search = await input.tools.searchRecipes({
    q: intent.q,
    alcoholGroupIds: intent.alcoholGroupIds.slice(0, 2),
    familyIds: intent.familyIds,
    flavorIds: intent.flavorIds,
    sort: intent.sort,
  });

  if (search.items.length > 0) {
    const recipes = search.items.map((r) => ({
      ...r,
      detailPath: r.detailPath || `/recipes/${r.id}`,
    }));
    return {
      kind: "library",
      assistantMessage:
        recipes.length === 1
          ? `按你的酒柜，找到这一杯：${recipes[0]!.nameZh}。`
          : `按你的酒柜，找到这 ${recipes.length} 杯。`,
      recipes,
      canSave: false,
      savePath: null,
    };
  }

  const inventory = await input.tools.getInventory();
  const catalog = await input.tools.listStandardIngredients();
  const generate =
    input.generateTemporary ??
    ((args) => defaultGenerateTemporary(input.llm, args));

  const generated = await generate({
    message,
    inventory: inventory.items,
    catalog: catalog.items,
  });

  const allowed = new Set(catalog.items.map((c) => c.id));
  const usedIds = (generated.ingredientIds ?? []).filter((id) => allowed.has(id));
  const nameById = new Map(catalog.items.map((c) => [c.id, c.nameZh]));
  const materialLine =
    usedIds.length > 0
      ? `\n用到的材料：${usedIds.map((id) => nameById.get(id) ?? id).join("、")}`
      : "";

  const text = `${generated.title}\n\n${generated.body}${materialLine}\n\n【${DISCLAIMER}】`;

  return {
    kind: "generated",
    assistantMessage: text,
    disclaimer: DISCLAIMER,
    text,
    title: generated.title,
    canSave: false,
    savePath: null,
  };
}

async function defaultGenerateTemporary(
  llm: LlmProvider,
  args: {
    message: string;
    inventory: { ingredientId: string; nameZh?: string; nameEn?: string }[];
    catalog: { id: string; nameZh: string; nameEn: string }[];
  },
) {
  const raw = await llm.completeJson({
    system: `Create a temporary cocktail recipe as JSON only:
{ "title": "", "body": "materials, amounts, steps, glassware, garnish as text", "ingredientIds": ["id", ...] }
Rules:
- ingredientIds MUST be subset of the provided catalog ids only.
- Prefer inventory ingredients when sensible; never claim the drink is complete or verified.
- Do not claim IBA / classic / official / bartender authority.
- Chinese or English matching the user language.
- body must include materials with amounts and ordered steps.`,
    user: JSON.stringify({
      request: args.message,
      inventory: args.inventory,
      catalog: args.catalog,
    }),
  });
  return generatedSchema.parse(raw);
}
