import type { ChatCompletionInput, ChatCompletionOutput, ChatModel } from "../../agents/src/index.js";
import { runWriteNextChapterWorkflow } from "./writeNextChapter.js";

await testWorkflowReviewsRevisesAndReturnsFinalDraft();

async function testWorkflowReviewsRevisesAndReturnsFinalDraft() {
  const model = createSequencedModel([
    {
      viewpoint: "沈砚贴身视角",
      objective: "确认回档真实存在，并找到第一处变量。",
      obstacle: "灵力枯竭和门外杀手提前出现。",
      change: "主角从被动确认转为主动试探。",
      sceneBeats: [
        {
          sceneNo: 1,
          purpose: "确认回档",
          conflict: "记忆缺口干扰判断",
          change: "发现玉佩裂纹",
        },
      ],
      rewardMoment: "用上一轮信息反制。",
      endingHook: "门外人说出上一轮才出现过的称呼。",
      riskNotes: [],
      warnings: [],
    },
    {
      title: "第三次醒来",
      content: "沈砚醒来后，意识到自己又回到了三日前。\n\n门外有人说：沈师弟，该醒了。",
      summary: "沈砚再次醒来，确认回档。",
      warnings: [],
    },
    {
      passed: false,
      overallScore: 72,
      summary: "说明感偏强，章末没有兑现钩子。",
      strengths: ["开头直接"],
      requiredRevisionInstruction: "压低说明感，补足门外人的试探称呼和章末拉力。",
      moduleFindings: [
        { moduleId: "anti_ai_voice", status: "warn", finding: "总结句偏多。" },
        { moduleId: "chapter_ending", status: "fail", finding: "章末未形成追读。" },
      ],
      issues: [
        {
          id: "issue-ending",
          severity: "critical",
          category: "chapter_ending",
          description: "章末没有兑现章纲钩子。",
          suggestion: "让门外人说出上一轮才出现过的称呼。",
        },
      ],
      warnings: [],
    },
    {
      title: "第三次醒来",
      content: "沈砚是在钟声里醒来的。\n\n他没有立刻坐起，只把手压在被褥下，摸到腰侧完好的皮肉。\n\n门外脚步声停住。那人在门外低声道：沈师弟，该醒了。别再装作第一次听见我的声音。这个称呼，只在上一轮死亡前出现过。",
      summary: "沈砚第三次醒来，压住回档秘密，并听见门外人说出上一轮才该出现的话。",
      changedSummary: "已补足章末试探和具体动作。",
      handledIssueIds: ["issue-ending"],
      unresolvedRisks: [],
      warnings: [],
    },
    {
      passed: true,
      overallScore: 88,
      summary: "修订稿达到本章目标，章末有追读钩子。",
      strengths: ["动作具体", "章末拉力明确"],
      requiredRevisionInstruction: "",
      moduleFindings: [
        { moduleId: "chapter_ending", status: "pass", finding: "章末能承接下一章。" },
      ],
      issues: [],
      warnings: [],
    },
  ]);

  const result = await runWriteNextChapterWorkflow({
    model,
    novelId: "novel-workflow-test",
    targetWords: 1800,
    repository: createRepository(),
  });

  assertEqual(result.reviewReports.length, 2);
  assertEqual(result.revisionHistory.length, 1);
  assertEqual(result.qualityGate.passed, true);
  assertEqual(result.qualityGate.score, 88);
  assertEqual(result.finalDraft.draftId, result.draft.draftId);
  assertEqual(result.initialDraft.draftId.startsWith("draft-chapter-plan-1-"), true);
  assertEqual(result.finalDraft.content.includes("上一轮死亡前出现过"), true);
  assertDeepEqual(
    result.agentRuns.map((run) => run.capabilityId),
    [
      "plan.createChapterDraftPlan",
      "chapter.writeNextChapter",
      "review.reviewChapter",
      "chapter.reviseChapter",
      "review.reviewChapter",
    ],
  );
}

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`断言失败：expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`断言失败：expected ${expectedJson}, got ${actualJson}`);
  }
}

function createSequencedModel(payloads: unknown[]): ChatModel {
  let index = 0;
  return {
    provider: "mock",
    model: "workflow-test",
    async complete(input: ChatCompletionInput): Promise<ChatCompletionOutput> {
      const payload = payloads[index++];
      if (!payload) {
        throw new Error(`没有为第 ${index} 次模型调用准备 mock payload。`);
      }
      return {
        provider: "mock",
        model: "workflow-test",
        content: JSON.stringify(payload),
        usage: {
          promptTokens: input.messages.reduce((sum, message) => sum + message.content.length, 0),
          completionTokens: 20,
          totalTokens: 20,
        },
      };
    },
  };
}

function createRepository() {
  return {
    assembleChapterProductionContext() {
      return {
        novel: {
          novelId: "novel-workflow-test",
          title: "天命回档",
          genre: "玄幻悬疑",
          hook: "主角死亡后回到三日前，但会失去记忆。",
          targetReaders: "喜欢升级、反转、悬疑感的男频读者",
          totalChapters: 120,
          currentVolume: "第一卷",
        },
        chapterNo: 1,
        chapterPlan: {
          id: "chapter-plan-1",
          novelId: "novel-workflow-test",
          chapterNo: 1,
          title: "第三次醒来",
          volumeTitle: "第一卷",
          objective: "主角确认回档真实存在，并找到第一处变量。",
          hook: "门外人说出只有上一轮死亡前才出现过的称呼。",
          status: "已确认",
        },
        chapterPlans: [],
        nearbyChapterPlans: [],
        context: {
          outlineSummary: "主角在连续死亡回档中寻找真相。",
          nextChapterObjective: "主角试探门外人。",
          forbiddenExpressions: ["命运的齿轮开始转动"],
          contextRefs: [{ id: "chapter-plan:1", type: "chapter" as const, title: "第三次醒来" }],
        },
        missingAssets: [],
        sourceRefs: [{ id: "chapter-plan:1", type: "chapter" as const, title: "第三次醒来" }],
      };
    },
  };
}
