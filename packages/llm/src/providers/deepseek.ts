import { LlmConfigurationError } from "../types.js";
import {
  OpenAICompatibleChatModel,
  type OpenAICompatibleChatModelConfig,
} from "./openaiCompatible.js";

export const DEEPSEEK_PROVIDER = "deepseek";
export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const DEEPSEEK_V4_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro"] as const;
export const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";

export type DeepSeekV4Model = (typeof DEEPSEEK_V4_MODELS)[number];

export interface DeepSeekChatModelConfig
  extends Partial<Omit<OpenAICompatibleChatModelConfig, "provider">> {
  apiKey: string;
  model?: DeepSeekV4Model | string;
}

export function createDeepSeekChatModel(config: DeepSeekChatModelConfig) {
  return new OpenAICompatibleChatModel({
    provider: DEEPSEEK_PROVIDER,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl ?? DEEPSEEK_BASE_URL,
    model: config.model ?? DEFAULT_DEEPSEEK_MODEL,
    headers: config.headers,
  });
}

export interface DeepSeekEnvConfig {
  provider: typeof DEEPSEEK_PROVIDER;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function loadDeepSeekConfigFromEnv(
  env: Record<string, string | undefined> = getRuntimeEnv(),
): DeepSeekEnvConfig {
  const apiKey = env.DEEPSEEK_API_KEY;

  if (!apiKey?.trim()) {
    throw new LlmConfigurationError("缺少 DEEPSEEK_API_KEY，无法创建 DeepSeek 模型客户端");
  }

  return {
    provider: DEEPSEEK_PROVIDER,
    apiKey,
    baseUrl: env.DEEPSEEK_BASE_URL?.trim() || DEEPSEEK_BASE_URL,
    model: env.DEEPSEEK_MODEL?.trim() || env.LLM_MODEL?.trim() || DEFAULT_DEEPSEEK_MODEL,
  };
}

function getRuntimeEnv(): Record<string, string | undefined> {
  const runtime = globalThis as unknown as {
    process?: { env?: Record<string, string | undefined> };
  };

  return runtime.process?.env ?? {};
}
