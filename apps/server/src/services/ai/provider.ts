import { isAiConfigured, loadAiConfig, type AiConfig } from "./config.js";
import { badRequest, serviceUnavailable } from "../../http.js";

export type CompleteJsonOptions = {
  system: string;
  user: string;
  /** Max retries after first failure (docs: auto retry once). */
  retries?: number;
};

export type LlmProvider = {
  isConfigured: () => boolean;
  completeJson: (opts: CompleteJsonOptions) => Promise<unknown>;
};

export function createOpenAiCompatibleProvider(
  config: AiConfig = loadAiConfig(),
  fetchImpl: typeof fetch = fetch,
): LlmProvider {
  return {
    isConfigured: () => isAiConfigured(config),
    async completeJson(opts) {
      if (!isAiConfigured(config)) {
        throw serviceUnavailable(
          "AI 未配置：请在服务端设置 AI_API_KEY（及可选 AI_BASE_URL / AI_MODEL）",
        );
      }
      const retries = opts.retries ?? 1;
      let lastError: unknown;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return await callOnce(config, opts, fetchImpl);
        } catch (e) {
          lastError = e;
        }
      }
      if (lastError instanceof Error && "status" in lastError) throw lastError;
      throw serviceUnavailable(
        lastError instanceof Error
          ? `AI 调用失败：${lastError.message}`
          : "AI 调用失败",
      );
    },
  };
}

async function callOnce(
  config: AiConfig,
  opts: CompleteJsonOptions,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const res = await fetchImpl(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });

  if (!res.ok) {
    throw serviceUnavailable(`AI 服务不可用（HTTP ${res.status}）`);
  }

  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw badRequest("AI 响应缺少内容");
  }
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw badRequest("AI 响应不是合法 JSON");
  }
}
