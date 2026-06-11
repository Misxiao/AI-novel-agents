import { LlmProviderError } from "./types.js";

export interface RetryOptions {
  /** 各次重试前的等待毫秒数，长度即最大重试次数 */
  delaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number, error: unknown) => void;
}

const DEFAULT_DELAYS_MS = [1000, 4000, 10000];

/** 429/5xx/网络错误重试，4xx 业务错误直接抛出 */
export function isRetryableLlmError(error: unknown): boolean {
  if (error instanceof LlmProviderError) {
    return error.status === undefined || error.status === 429 || error.status >= 500;
  }
  return error instanceof TypeError || (error instanceof Error && error.name === "FetchError");
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const delays = options.delaysMs ?? DEFAULT_DELAYS_MS;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= delays.length || !isRetryableLlmError(error)) {
        throw error;
      }
      options.onRetry?.(attempt + 1, error);
      await sleep(delays[attempt] + Math.random() * 500);
    }
  }
}
