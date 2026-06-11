import assert from "node:assert/strict";
import { test } from "node:test";

import { createDeepSeekModel, readSseData } from "./deepseek.js";
import { withRetry, isRetryableLlmError } from "./retry.js";
import { createModelRouter } from "./router.js";
import { LlmProviderError, type StreamEvent } from "./types.js";

function sseResponse(lines: string[], init: ResponseInit = {}): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(lines.join("\n") + "\n"));
      controller.close();
    },
  });
  return new Response(body, { status: 200, ...init });
}

function chunkLine(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}`;
}

test("stream 解析 SSE 增量并聚合 usage", async () => {
  const fetchMock = async () =>
    sseResponse([
      chunkLine({ choices: [{ delta: { content: "第一" } }] }),
      chunkLine({ choices: [{ delta: { content: "章" }, finish_reason: "stop" }] }),
      chunkLine({ usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }),
      "data: [DONE]",
    ]);

  const model = createDeepSeekModel(
    { apiKey: "key", model: "deepseek-v4-flash" },
    { fetch: fetchMock as typeof fetch },
  );

  const events: StreamEvent[] = [];
  for await (const event of model.stream({ messages: [{ role: "user", content: "写" }] })) {
    events.push(event);
  }

  assert.deepEqual(
    events.filter((e) => e.type === "delta").map((e) => (e as { text: string }).text),
    ["第一", "章"],
  );
  const done = events.at(-1);
  assert.equal(done?.type, "done");
  if (done?.type === "done") {
    assert.equal(done.output.content, "第一章");
    assert.equal(done.output.finishReason, "stop");
    assert.deepEqual(done.output.usage, {
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });
  }
});

test("complete 聚合流式结果", async () => {
  const fetchMock = async () =>
    sseResponse([
      chunkLine({ choices: [{ delta: { content: "你好" }, finish_reason: "stop" }] }),
      "data: [DONE]",
    ]);

  const model = createDeepSeekModel(
    { apiKey: "key", model: "m" },
    { fetch: fetchMock as typeof fetch },
  );
  const output = await model.complete({ messages: [{ role: "user", content: "hi" }] });
  assert.equal(output.content, "你好");
  assert.equal(output.provider, "deepseek");
});

test("readSseData 处理跨 chunk 截断的行", async () => {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"a"'));
      controller.enqueue(encoder.encode(':1}\ndata: [DONE]\n'));
      controller.close();
    },
  });

  const collected: string[] = [];
  for await (const data of readSseData(body)) {
    collected.push(data);
  }
  assert.deepEqual(collected, ['{"a":1}']);
});

test("建连失败 429 时按退避重试后成功", async () => {
  let calls = 0;
  const fetchMock = async () => {
    calls++;
    if (calls < 3) {
      return new Response(JSON.stringify({ error: { message: "限流" } }), { status: 429 });
    }
    return sseResponse([
      chunkLine({ choices: [{ delta: { content: "成" }, finish_reason: "stop" }] }),
      "data: [DONE]",
    ]);
  };

  const sleeps: number[] = [];
  const model = createDeepSeekModel(
    { apiKey: "key", model: "m" },
    {
      fetch: fetchMock as typeof fetch,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    },
  );

  const output = await model.complete({ messages: [{ role: "user", content: "hi" }] });
  assert.equal(output.content, "成");
  assert.equal(calls, 3);
  assert.equal(sleeps.length, 2);
  assert.ok(sleeps[0] >= 1000 && sleeps[0] < 1500);
  assert.ok(sleeps[1] >= 4000 && sleeps[1] < 4500);
});

test("4xx 业务错误不重试", async () => {
  let calls = 0;
  const fetchMock = async () => {
    calls++;
    return new Response(JSON.stringify({ error: { message: "参数错误" } }), { status: 400 });
  };

  const model = createDeepSeekModel(
    { apiKey: "key", model: "m" },
    { fetch: fetchMock as typeof fetch, sleep: async () => {} },
  );

  await assert.rejects(
    model.complete({ messages: [{ role: "user", content: "hi" }] }),
    (error: unknown) => error instanceof LlmProviderError && error.status === 400,
  );
  assert.equal(calls, 1);
});

test("withRetry 耗尽次数后抛出原错误", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls++;
        throw new LlmProviderError("挂了", { provider: "deepseek", status: 500 });
      },
      { delaysMs: [1, 1], sleep: async () => {} },
    ),
    /挂了/,
  );
  assert.equal(calls, 3);
});

test("isRetryableLlmError 区分错误类型", () => {
  assert.ok(isRetryableLlmError(new LlmProviderError("x", { provider: "d", status: 500 })));
  assert.ok(isRetryableLlmError(new LlmProviderError("x", { provider: "d", status: 429 })));
  assert.ok(!isRetryableLlmError(new LlmProviderError("x", { provider: "d", status: 400 })));
  assert.ok(isRetryableLlmError(new TypeError("fetch failed")));
  assert.ok(!isRetryableLlmError(new Error("其他")));
});

test("模型路由按档位读取环境变量并缓存实例", () => {
  const router = createModelRouter({
    DEEPSEEK_API_KEY: "key",
    DEEPSEEK_MODEL: "deepseek-v4-flash",
    LLM_PROSE_MODEL: "deepseek:deepseek-v4-pro",
  });

  assert.equal(router("plan").model, "deepseek-v4-flash");
  assert.equal(router("prose").model, "deepseek-v4-pro");
  assert.equal(router("review").model, "deepseek-v4-flash");
  assert.equal(router("plan"), router("review"));
});
