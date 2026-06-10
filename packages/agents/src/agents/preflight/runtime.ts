import type {
  AgentCapabilityRunMeta,
  ChatCompletionInput,
  ChatCompletionOutput,
} from "../../core/types.js";

export interface CompletionWithTiming {
  completion: ChatCompletionOutput;
  startedAt: string;
  finishedAt: string;
}

export function parseJsonPayload<TPayload extends object>(
  agentName: string,
  content: string,
): TPayload {
  try {
    const parsed = JSON.parse(stripCodeFence(content)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not object");
    }
    return parsed as TPayload;
  } catch {
    throw new Error(`${agentName} 模型响应不是合法 JSON`);
  }
}

export function stripCodeFence(content: string) {
  const trimmed = content.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

export function requiredText(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`前置资产缺少 ${fieldName}`);
  }
  return value.trim();
}

export function optionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

export function positiveInteger(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

export function buildRunMeta(
  agentId: string,
  capabilityId: string,
  run: CompletionWithTiming,
): AgentCapabilityRunMeta {
  return {
    agentId,
    capabilityId,
    provider: run.completion.provider,
    model: run.completion.model,
    usage: run.completion.usage,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  };
}

export type CompleteWithTiming = (input: ChatCompletionInput) => Promise<CompletionWithTiming>;
