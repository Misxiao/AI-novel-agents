import type { ChatModel, ModelTier, TokenUsage } from "@ai-novel-agents/llm";

export interface AgentUsageReport {
  capabilityId: string;
  provider: string;
  model: string;
  usage?: TokenUsage;
  durationMs: number;
}

export interface AgentContext {
  /** 按档位取模型，由组装层注入路由 */
  model(tier: ModelTier): ChatModel;
  /** 流式正文回调；非流式场景可不提供 */
  onDelta?: (text: string) => void;
  /** 每次 LLM 调用完成后上报用量 */
  onUsage?: (report: AgentUsageReport) => void;
}

export interface Capability<TInput, TOutput> {
  /** 形如 "writer.writeChapter" */
  id: string;
  agentId: string;
  /** 中文一句话能力描述（给人和将来的 director agent 看） */
  summary: string;
  /** 中文输入说明 */
  inputHint: string;
  tier: ModelTier;
  run(input: TInput, ctx: AgentContext): Promise<TOutput>;
}

export function defineCapability<TInput, TOutput>(
  capability: Capability<TInput, TOutput>,
): Capability<TInput, TOutput> {
  return capability;
}
