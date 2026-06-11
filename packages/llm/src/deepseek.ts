import { withRetry } from "./retry.js";
import {
  LlmConfigurationError,
  LlmProviderError,
  type ChatCompletionInput,
  type ChatCompletionOutput,
  type ChatModel,
  type StreamEvent,
  type TokenUsage,
} from "./types.js";

export const DEEPSEEK_PROVIDER = "deepseek";
export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

export interface DeepSeekModelConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface DeepSeekModelDeps {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

interface SseChunk {
  choices?: Array<{
    delta?: { content?: string | null };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
  error?: { message?: string };
}

export function createDeepSeekModel(
  config: DeepSeekModelConfig,
  deps: DeepSeekModelDeps = {},
): ChatModel {
  if (!config.apiKey.trim()) {
    throw new LlmConfigurationError("缺少 DEEPSEEK_API_KEY，无法创建 DeepSeek 模型客户端");
  }
  const baseUrl = (config.baseUrl ?? DEEPSEEK_BASE_URL).replace(/\/+$/, "");
  const doFetch = deps.fetch ?? fetch;

  async function connect(input: ChatCompletionInput): Promise<Response> {
    const response = await doFetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: input.messages,
        temperature: input.temperature,
        top_p: input.topP,
        max_tokens: input.maxTokens,
        response_format:
          input.responseFormat === "json_object" ? { type: "json_object" } : undefined,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: input.abortSignal,
    });

    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new LlmProviderError(message, {
        provider: DEEPSEEK_PROVIDER,
        status: response.status,
      });
    }
    if (!response.body) {
      throw new LlmProviderError("DeepSeek 响应缺少消息体", { provider: DEEPSEEK_PROVIDER });
    }
    return response;
  }

  const model: ChatModel = {
    provider: DEEPSEEK_PROVIDER,
    model: config.model,

    async *stream(input) {
      if (input.messages.length === 0) {
        throw new LlmConfigurationError("messages 不能为空");
      }
      // 重试只发生在建连阶段；流中途断开交给上层步骤级重试
      const response = await withRetry(() => connect(input), { sleep: deps.sleep });

      let content = "";
      let finishReason: string | undefined;
      let usage: TokenUsage | undefined;

      for await (const data of readSseData(response.body!)) {
        const chunk = parseChunk(data);
        if (chunk.error?.message) {
          throw new LlmProviderError(chunk.error.message, { provider: DEEPSEEK_PROVIDER });
        }
        const choice = chunk.choices?.[0];
        if (choice?.delta?.content) {
          content += choice.delta.content;
          yield { type: "delta", text: choice.delta.content } satisfies StreamEvent;
        }
        if (choice?.finish_reason) {
          finishReason = choice.finish_reason;
        }
        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          };
        }
      }

      const output: ChatCompletionOutput = {
        provider: DEEPSEEK_PROVIDER,
        model: config.model,
        content,
        finishReason,
        usage,
      };
      yield { type: "done", output };
    },

    async complete(input) {
      for await (const event of model.stream(input)) {
        if (event.type === "done") {
          return event.output;
        }
      }
      throw new LlmProviderError("DeepSeek 流式响应未正常结束", {
        provider: DEEPSEEK_PROVIDER,
      });
    },
  };

  return model;
}

/** 解析 SSE 流，逐条产出 data 字段内容（不含 [DONE] 哨兵） */
export async function* readSseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
        buffer = buffer.slice(newlineIndex + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        if (data) yield data;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseChunk(data: string): SseChunk {
  try {
    return JSON.parse(data) as SseChunk;
  } catch {
    throw new LlmProviderError("DeepSeek 返回了无法解析的流式数据", {
      provider: DEEPSEEK_PROVIDER,
    });
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message ?? `DeepSeek 请求失败（HTTP ${response.status}）`;
  } catch {
    return `DeepSeek 请求失败（HTTP ${response.status}）`;
  }
}
