import {
  LlmConfigurationError,
  LlmProviderError,
  type ChatCompletionInput,
  type ChatCompletionOutput,
  type ChatMessage,
  type ChatModel,
  type TokenUsage,
} from "../types.js";

export interface OpenAICompatibleChatModelConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  headers?: Record<string, string>;
}

interface OpenAICompatibleResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    type?: string;
  };
}

export class OpenAICompatibleChatModel implements ChatModel {
  readonly provider: string;
  readonly model: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(config: OpenAICompatibleChatModelConfig) {
    if (!config.apiKey.trim()) {
      throw new LlmConfigurationError(`${config.provider} API Key 未配置`);
    }

    if (!config.baseUrl.trim()) {
      throw new LlmConfigurationError(`${config.provider} baseUrl 未配置`);
    }

    if (!config.model.trim()) {
      throw new LlmConfigurationError(`${config.provider} model 未配置`);
    }

    this.provider = config.provider;
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.headers = config.headers ?? {};
  }

  async complete(input: ChatCompletionInput): Promise<ChatCompletionOutput> {
    if (input.messages.length === 0) {
      throw new LlmConfigurationError("messages 不能为空");
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...this.headers,
      },
      body: JSON.stringify(this.toRequestBody(input)),
      signal: input.abortSignal,
    });

    const payload = await this.readPayload(response);

    if (!response.ok) {
      const message = payload.error?.message ?? `${this.provider} 请求失败`;
      throw new LlmProviderError(message, {
        provider: this.provider,
        status: response.status,
      });
    }

    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new LlmProviderError(`${this.provider} 响应缺少文本内容`, {
        provider: this.provider,
        status: response.status,
      });
    }

    return {
      id: payload.id,
      provider: this.provider,
      model: payload.model ?? this.model,
      content,
      finishReason: payload.choices?.[0]?.finish_reason ?? undefined,
      usage: this.toUsage(payload.usage),
    };
  }

  private toRequestBody(input: ChatCompletionInput): Record<string, unknown> {
    return {
      model: this.model,
      messages: input.messages.map(toOpenAIMessage),
      temperature: input.temperature,
      top_p: input.topP,
      max_tokens: input.maxTokens,
      response_format:
        input.responseFormat === "json_object" ? { type: "json_object" } : undefined,
    };
  }

  private async readPayload(response: Response): Promise<OpenAICompatibleResponse> {
    try {
      return (await response.json()) as OpenAICompatibleResponse;
    } catch {
      throw new LlmProviderError(`${this.provider} 返回了无法解析的响应`, {
        provider: this.provider,
        status: response.status,
      });
    }
  }

  private toUsage(usage: OpenAICompatibleResponse["usage"]): TokenUsage | undefined {
    if (!usage) {
      return undefined;
    }

    return {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    };
  }
}

function toOpenAIMessage(message: ChatMessage): Record<string, string> {
  return {
    role: message.role,
    content: message.content,
    ...(message.name ? { name: message.name } : {}),
  };
}
