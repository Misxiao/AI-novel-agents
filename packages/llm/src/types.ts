export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ChatCompletionInput {
  messages: ChatMessage[];
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json_object";
  abortSignal?: AbortSignal;
}

export interface ChatCompletionOutput {
  provider: string;
  model: string;
  content: string;
  finishReason?: string;
  usage?: TokenUsage;
}

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; output: ChatCompletionOutput };

export interface ChatModel {
  provider: string;
  model: string;
  complete(input: ChatCompletionInput): Promise<ChatCompletionOutput>;
  stream(input: ChatCompletionInput): AsyncIterable<StreamEvent>;
}

/** 模型档位：plan 做规划/大纲，prose 写正文，review 做评审/记忆提取 */
export type ModelTier = "plan" | "prose" | "review";

export type ModelRouter = (tier: ModelTier) => ChatModel;

export class LlmConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmConfigurationError";
  }
}

export class LlmProviderError extends Error {
  readonly status?: number;
  readonly provider: string;

  constructor(message: string, options: { provider: string; status?: number }) {
    super(message);
    this.name = "LlmProviderError";
    this.provider = options.provider;
    this.status = options.status;
  }
}
