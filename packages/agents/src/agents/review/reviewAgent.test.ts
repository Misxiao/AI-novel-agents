import type { ChatCompletionInput, ChatCompletionOutput, ChatModel } from "../../core/types.js";
import type { ReviewChapterInput } from "./types.js";
import { ReviewAgent } from "./reviewAgent.js";

const baseInput: ReviewChapterInput = {
  novel: {
    novelId: "novel-review-test",
    title: "天命回档",
    genre: "玄幻悬疑",
    hook: "主角死亡后回到三日前，但每次都会失去一段记忆。",
    targetReaders: "喜欢升级、反转、悬疑感的男频读者",
    totalChapters: 120,
    currentVolume: "第一卷",
  },
  chapterPlan: {
    id: "chapter-plan-1",
    novelId: "novel-review-test",
    chapterNo: 1,
    title: "第三次醒来",
    volumeTitle: "第一卷",
    objective: "主角确认回档真实存在，并找到第一处变量。",
    hook: "门外人说出只有上一轮死亡前才出现过的称呼。",
    status: "已确认",
  },
  context: {
    previousChapterSummary: "",
    nextChapterObjective: "主角试探门外人。",
    canonFacts: ["主角已经经历两次死亡回档。"],
    forbiddenExpressions: ["命运的齿轮开始转动"],
  },
  draftPlan: {
    planId: "draft-plan-1",
    novelId: "novel-review-test",
    chapterPlanId: "chapter-plan-1",
    chapterNo: 1,
    viewpoint: "主角贴身视角",
    objective: "确认回档真实存在",
    obstacle: "灵力枯竭和门外杀手提前出现",
    change: "主角从被动确认转为主动试探",
    sceneBeats: [
      {
        sceneNo: 1,
        purpose: "用具体异样证明回档不是梦",
        conflict: "身体疲惫让判断不稳定",
        change: "主角发现旧玉佩的新裂纹",
      },
    ],
    rewardMoment: "主角利用上一轮信息反制第一次试探。",
    endingHook: "门外响起上一轮杀死他的人的声音。",
    riskNotes: ["不要提前解释回档源头。"],
    warnings: [],
    usedContextRefs: [],
    moduleChain: [],
    provider: "mock",
    model: "mock",
    createdAt: "2026-06-04T00:00:00.000Z",
  },
  draft: {
    draftId: "draft-1",
    novelId: "novel-review-test",
    chapterPlanId: "chapter-plan-1",
    chapterNo: 1,
    title: "第三次醒来",
    content: "沈砚醒来后，意识到自己又回到了三日前。\n\n门外有人说：沈师弟，该醒了。",
    summary: "主角醒来并确认回档。",
  },
  targetWords: 1800,
  qualityThreshold: 85,
};

await testParsesStructuredReviewAndFailsCriticalGate();
await testInvalidJsonFallsBackToDeterministicReview();

async function testParsesStructuredReviewAndFailsCriticalGate() {
  const model = createModel(() => ({
    passed: true,
    overallScore: 91,
    summary: "模型认为可读，但存在关键章末问题。",
    strengths: ["开头进入较快"],
    requiredRevisionInstruction: "补足章末变量和对白压力。",
    moduleFindings: [
      { moduleId: "chapter_ending", status: "fail", finding: "章末没有落在变化上。" },
    ],
    issues: [
      {
        id: "ending-1",
        severity: "critical",
        category: "chapter_ending",
        description: "章末没有兑现章纲钩子。",
        suggestion: "让门外人说出上一轮才出现过的称呼。",
      },
    ],
    warnings: [],
  }));
  const result = await new ReviewAgent({ model }).reviewChapter(baseInput);

  assertEqual(result.output.passed, false);
  assertEqual(result.output.overallScore, 91);
  assertEqual(result.output.issues[0]?.id, "ending-1");
  assertEqual(result.output.requiredRevisionInstruction, "补足章末变量和对白压力。");
  assertEqual(result.run.agentId, "review");
  assertEqual(result.run.capabilityId, "review.reviewChapter");
}

async function testInvalidJsonFallsBackToDeterministicReview() {
  const model = createModel(() => "不是 JSON");
  const result = await new ReviewAgent({ model }).reviewChapter(baseInput);

  assertEqual(result.output.passed, false);
  assertOk(result.output.overallScore < 85);
  assertOk(result.output.issues.some((issue) => issue.category === "chapter_ending"));
  assertOk(result.output.warnings.some((warning) => warning.includes("合法 JSON")));
}

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`断言失败：expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertOk(value: unknown) {
  if (!value) {
    throw new Error("断言失败：expected truthy value");
  }
}

function createModel(payloadFactory: () => unknown): ChatModel {
  return {
    provider: "mock",
    model: "review-test",
    async complete(input: ChatCompletionInput): Promise<ChatCompletionOutput> {
      const payload = payloadFactory();
      return {
        provider: "mock",
        model: "review-test",
        content: typeof payload === "string" ? payload : JSON.stringify(payload),
        usage: {
          promptTokens: input.messages.reduce((sum, message) => sum + message.content.length, 0),
          completionTokens: 10,
          totalTokens: 10,
        },
      };
    },
  };
}
