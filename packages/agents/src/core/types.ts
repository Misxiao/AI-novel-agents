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

export interface AgentRuntime {
  model?: ChatModel;
  now?: () => Date;
  createModel?: () => ChatModel | Promise<ChatModel>;
}

export interface AgentCapabilityRunMeta {
  agentId: string;
  capabilityId: string;
  provider: string;
  model: string;
  startedAt: string;
  finishedAt: string;
  usage?: TokenUsage;
}

export interface AgentCapabilityResult<TOutput> {
  output: TOutput;
  run: AgentCapabilityRunMeta;
}

export interface AgentCapability<TInput, TOutput> {
  id: string;
  description: string;
  run(input: TInput, runtime: AgentRuntime): Promise<AgentCapabilityResult<TOutput>>;
}

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
}
