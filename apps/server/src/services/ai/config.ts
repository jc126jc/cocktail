export type AiConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export function loadAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  return {
    baseUrl: (env.AI_BASE_URL ?? "https://api.siliconflow.cn/v1").replace(
      /\/$/,
      "",
    ),
    apiKey: env.AI_API_KEY?.trim() ?? "",
    model: env.AI_MODEL?.trim() || "deepseek-ai/DeepSeek-V4-Flash",
  };
}

export function isAiConfigured(config: AiConfig = loadAiConfig()): boolean {
  return Boolean(config.apiKey && config.baseUrl && config.model);
}
