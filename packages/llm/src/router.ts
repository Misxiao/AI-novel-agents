import { createDeepSeekModel, DEEPSEEK_PROVIDER } from "./deepseek.js";
import {
  LlmConfigurationError,
  type ChatModel,
  type ModelRouter,
  type ModelTier,
} from "./types.js";

export const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";

const TIER_ENV_KEYS: Record<ModelTier, string> = {
  plan: "LLM_PLAN_MODEL",
  prose: "LLM_PROSE_MODEL",
  review: "LLM_REVIEW_MODEL",
};

type Env = Record<string, string | undefined>;

/**
 * 按档位路由模型。档位环境变量格式 "deepseek:model-name"，
 * 未配置时回落 DEEPSEEK_MODEL，再回落默认模型。
 */
export function createModelRouter(env: Env = process.env): ModelRouter {
  const cache = new Map<string, ChatModel>();

  return (tier) => {
    const spec =
      env[TIER_ENV_KEYS[tier]]?.trim() ||
      `${DEEPSEEK_PROVIDER}:${env.DEEPSEEK_MODEL?.trim() || DEFAULT_DEEPSEEK_MODEL}`;

    let model = cache.get(spec);
    if (!model) {
      model = createModelFromSpec(spec, env);
      cache.set(spec, model);
    }
    return model;
  };
}

function createModelFromSpec(spec: string, env: Env): ChatModel {
  const colonIndex = spec.indexOf(":");
  const provider = colonIndex >= 0 ? spec.slice(0, colonIndex) : DEEPSEEK_PROVIDER;
  const modelName = colonIndex >= 0 ? spec.slice(colonIndex + 1) : spec;

  if (provider !== DEEPSEEK_PROVIDER) {
    throw new LlmConfigurationError(`暂不支持的模型供应商：${provider}`);
  }
  return createDeepSeekModel({
    apiKey: env.DEEPSEEK_API_KEY ?? "",
    model: modelName,
    baseUrl: env.DEEPSEEK_BASE_URL,
  });
}
