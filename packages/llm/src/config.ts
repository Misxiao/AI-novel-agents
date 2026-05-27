import { LlmConfigurationError, type ChatModel } from "./types.js";
import {
  createDeepSeekChatModel,
  DEEPSEEK_PROVIDER,
  loadDeepSeekConfigFromEnv,
} from "./providers/deepseek.js";

export type SupportedLlmProvider = typeof DEEPSEEK_PROVIDER;

export function createDefaultChatModel(
  env: Record<string, string | undefined> = getRuntimeEnv(),
): ChatModel {
  const provider = env.LLM_PROVIDER?.trim() || DEEPSEEK_PROVIDER;

  if (provider !== DEEPSEEK_PROVIDER) {
    throw new LlmConfigurationError(`暂不支持的模型供应商：${provider}`);
  }

  return createDeepSeekChatModel(loadDeepSeekConfigFromEnv(env));
}

function getRuntimeEnv(): Record<string, string | undefined> {
  const runtime = globalThis as unknown as {
    process?: { env?: Record<string, string | undefined> };
  };

  return runtime.process?.env ?? {};
}
