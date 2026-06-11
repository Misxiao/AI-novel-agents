import type { ChatCompletionInput, ChatMessage, ModelTier } from "@ai-novel-agents/llm";

import type { AgentContext } from "./capability.js";

interface CallOptions {
  temperature?: number;
  maxTokens?: number;
}

/** 调用模型并解析 JSON 输出；解析失败抛出含原文片段的错误，交给上层步骤级重试 */
export async function completeJson<T>(
  ctx: AgentContext,
  capability: { id: string; tier: ModelTier },
  messages: ChatMessage[],
  options: CallOptions = {},
): Promise<T> {
  const content = await call(ctx, capability, messages, {
    ...options,
    responseFormat: "json_object",
  });
  const stripped = stripCodeFence(content);
  try {
    return JSON.parse(stripped) as T;
  } catch {
    throw new Error(
      `${capability.id} 返回了无法解析的 JSON：${stripped.slice(0, 200)}`,
    );
  }
}

/** 调用模型流式生成纯文本（正文），增量通过 ctx.onDelta 透出 */
export async function streamText(
  ctx: AgentContext,
  capability: { id: string; tier: ModelTier },
  messages: ChatMessage[],
  options: CallOptions = {},
): Promise<string> {
  return call(ctx, capability, messages, { ...options, streamDeltas: true });
}

async function call(
  ctx: AgentContext,
  capability: { id: string; tier: ModelTier },
  messages: ChatMessage[],
  options: CallOptions & {
    responseFormat?: ChatCompletionInput["responseFormat"];
    streamDeltas?: boolean;
  },
): Promise<string> {
  const model = ctx.model(capability.tier);
  const startedAt = Date.now();
  const input: ChatCompletionInput = {
    messages,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    responseFormat: options.responseFormat,
  };

  try {
    let output;
    if (options.streamDeltas && ctx.onDelta) {
      for await (const event of model.stream(input)) {
        if (event.type === "delta") {
          ctx.onDelta(event.text);
        } else {
          output = event.output;
        }
      }
      if (!output) {
        throw new Error(`${capability.id} 流式响应未正常结束`);
      }
    } else {
      output = await model.complete(input);
    }

    ctx.onUsage?.({
      capabilityId: capability.id,
      provider: output.provider,
      model: output.model,
      usage: output.usage,
      durationMs: Date.now() - startedAt,
    });
    return output.content;
  } catch (error) {
    ctx.onUsage?.({
      capabilityId: capability.id,
      provider: model.provider,
      model: model.model,
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

function stripCodeFence(content: string): string {
  const trimmed = content.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1] : trimmed;
}
