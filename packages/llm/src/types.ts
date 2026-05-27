export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
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
  id?: string;
  provider: string;
  model: string;
  content: string;
  finishReason?: string;
  usage?: TokenUsage;
}

export interface ChatModel {
  provider: string;
  model: string;
  complete(input: ChatCompletionInput): Promise<ChatCompletionOutput>;
}

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
