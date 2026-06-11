import type { ChatCompletionInput, ChatModel, StreamEvent } from "@ai-novel-agents/llm";

export type MockResponder = string | ((input: ChatCompletionInput) => string);

/**
 * 按脚本顺序应答的 mock 模型；脚本耗尽后复用最后一条。
 * 供 agents/workflow/cli 测试与 --mock 模式共用。
 */
export function createScriptedModel(
  responders: MockResponder[],
  options: { provider?: string; model?: string } = {},
): ChatModel & { calls: ChatCompletionInput[] } {
  const calls: ChatCompletionInput[] = [];

  function respond(input: ChatCompletionInput): string {
    const responder = responders[Math.min(calls.length - 1, responders.length - 1)];
    return typeof responder === "function" ? responder(input) : responder;
  }

  const model = {
    provider: options.provider ?? "mock",
    model: options.model ?? "mock-model",
    calls,

    async complete(input: ChatCompletionInput) {
      calls.push(input);
      return {
        provider: model.provider,
        model: model.model,
        content: respond(input),
        finishReason: "stop",
        usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      };
    },

    async *stream(input: ChatCompletionInput): AsyncIterable<StreamEvent> {
      calls.push(input);
      const content = respond(input);
      // 切成两段模拟增量
      const mid = Math.ceil(content.length / 2);
      yield { type: "delta", text: content.slice(0, mid) };
      yield { type: "delta", text: content.slice(mid) };
      yield {
        type: "done",
        output: {
          provider: model.provider,
          model: model.model,
          content,
          finishReason: "stop",
          usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
        },
      };
    },
  };

  return model;
}
