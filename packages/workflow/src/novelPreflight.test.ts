import type { ChatCompletionInput, ChatCompletionOutput, ChatModel } from "../../agents/src/index.js";
import { NovelDatabase } from "../../db/src/index.js";
import {
  ChapterProductionRepository,
  NovelPreflightRepository,
} from "../../repositories/src/index.js";
import { runNovelPreflightWorkflow } from "./novelPreflight.js";

const dbPath = `/private/tmp/ai-novel-agents-preflight-workflow-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const db = new NovelDatabase(dbPath);
const repository = new NovelPreflightRepository(db);
const emptyNovel = repository.createEmptyNovel();
const otherNovel = repository.createEmptyNovel();

const result = await runNovelPreflightWorkflow({
  novelId: emptyNovel.novelId,
  seedNotes: "主角死亡后回到三天前，但会丢失一段记忆。背景是灵气枯竭的修真世界。",
  targetWords: 360000,
  chapterPlanCount: 10,
  model: createSequencedModel(buildPayloads(emptyNovel.novelId)),
  repository,
});

assertEqual(result.task.status, "waiting_for_user");
assertEqual(result.foundationDraft.novelId, emptyNovel.novelId);
assertEqual(result.settingDraft.novelId, emptyNovel.novelId);
assertEqual(result.outlineDraft.novelId, emptyNovel.novelId);
assertEqual(result.chapterPlans.length, 10);
assertDeepEqual(
  result.agentRuns.map((run) => run.capabilityId),
  [
    "inspiration.generateFoundationDraft",
    "review.reviewFoundation",
    "setting.generateSettingDraft",
    "review.reviewSetting",
    "outline.generateInitialOutline",
    "review.reviewOutline",
  ],
);

assertEqual(repository.getDraft(emptyNovel.novelId, "foundation")?.status, "待确认");
assertEqual(repository.getDraft(emptyNovel.novelId, "setting")?.status, "待确认");
assertEqual(repository.getDraft(emptyNovel.novelId, "outline")?.status, "待确认");
assertEqual(repository.getDraft(otherNovel.novelId, "foundation"), null);
assertEqual(db.listTasks(emptyNovel.novelId)[0]?.status, "waiting_for_user");

const chapterContext = new ChapterProductionRepository(db).assembleChapterProductionContext({
  novelId: emptyNovel.novelId,
  chapterNo: 1,
});
assertOk(chapterContext.missingAssets.includes("outline"));
assertEqual(chapterContext.context.canonFacts?.length, 0);

await testInvalidJsonDoesNotSaveDrafts();

async function testInvalidJsonDoesNotSaveDrafts() {
  const failedNovel = repository.createEmptyNovel();
  const invalidModel: ChatModel = {
    provider: "mock",
    model: "invalid-json",
    async complete(): Promise<ChatCompletionOutput> {
      return {
        provider: "mock",
        model: "invalid-json",
        content: "not-json",
      };
    },
  };

  try {
    await runNovelPreflightWorkflow({
      novelId: failedNovel.novelId,
      seedNotes: "一个模糊想法",
      targetWords: 100000,
      model: invalidModel,
      repository,
    });
  } catch {
    assertEqual(repository.getDraft(failedNovel.novelId, "foundation"), null);
    assertEqual(repository.getDraft(failedNovel.novelId, "setting"), null);
    assertEqual(repository.getDraft(failedNovel.novelId, "outline"), null);
    assertEqual(db.listTasks(failedNovel.novelId)[0]?.status, "failed");
    return;
  }
  throw new Error("断言失败：非法 JSON 应导致 workflow 失败");
}

function buildPayloads(novelId: string): unknown[] {
  return [
    {
      novelId,
      titleCandidates: ["三日前死局"],
      synopsis: "沈砚在死亡回档中追查灭门真相。",
      hook: "死亡后回到三日前，但会失去记忆。",
      sellingPoint: "回档与失忆形成双重压力。",
      premise: "灵气枯竭时代的宗门灭门循环。",
      mainConflict: "在遗忘真相前阻止灭门。",
      storyEngine: "每轮获得线索，同时丢失认知。",
      targetReaders: "玄幻悬疑读者",
      tone: "紧张克制",
      targetWords: 360000,
      estimatedChapters: 120,
      estimatedVolumes: 4,
      chapterWordTarget: 3000,
      risks: [],
      questionsForAuthor: [],
      status: "待确认",
    },
    reviewPayload("基础盘通过"),
    {
      novelId,
      background: "灵气枯竭导致宗门争夺遗物。",
      worldRules: ["死亡最多回到三日前"],
      powerSystem: "记忆驱动遗物",
      factions: ["玄衡宗"],
      locations: ["玄衡山门"],
      constraints: ["回档必须失去记忆"],
      characterSeeds: [
        {
          id: "character-1",
          name: "沈砚",
          role: "主角",
          desire: "阻止灭门",
          conflict: "记忆丢失",
          initialState: "第三次回档",
          arcHint: "学会信任他人",
        },
      ],
      relationshipSeeds: [],
      styleGuidance: ["动作优先"],
      forbiddenExpressions: [],
      canonCandidates: ["灵气正在枯竭"],
      risks: [],
      status: "待确认",
    },
    reviewPayload("设定通过"),
    {
      novelId,
      masterOutline: {
        opening: "第三次回档醒来。",
        mainGoal: "阻止灭门。",
        escalation: "宗门内鬼升级为跨宗门争夺。",
        climax: "用最后记忆换取回档。",
        ending: "终止回档。",
        protagonistArc: "从独行到信任。",
      },
      volumes: [{
        id: "volume-1",
        title: "第一卷",
        goal: "活过灭门夜",
        conflict: "敌人随试探改变行动",
        highlights: ["反杀刺客"],
        chapterRange: "1-30",
        status: "未开始",
      }],
      chapterPlans: Array.from({ length: 10 }, (_, index) => ({
        id: `chapter-plan-${index + 1}`,
        novelId,
        chapterNo: index + 1,
        title: `第 ${index + 1} 章`,
        volumeTitle: "第一卷",
        objective: `推进线索 ${index + 1}`,
        hook: `留下疑问 ${index + 1}`,
        status: "草稿",
      })),
      timelineEvents: [],
      foreshadowing: [],
      issues: [],
      status: "待确认",
    },
    reviewPayload("大纲通过"),
  ];
}

function reviewPayload(summary: string) {
  return {
    passed: true,
    overallScore: 88,
    summary,
    strengths: ["结构完整"],
    issues: [],
    requiredRevisionInstruction: "",
    warnings: [],
  };
}

function createSequencedModel(payloads: unknown[]): ChatModel {
  let index = 0;
  return {
    provider: "mock",
    model: "preflight-workflow-test",
    async complete(input: ChatCompletionInput): Promise<ChatCompletionOutput> {
      const payload = payloads[index++];
      if (payload === undefined) {
        throw new Error(`没有为第 ${index} 次模型调用准备 payload。`);
      }
      return {
        provider: "mock",
        model: "preflight-workflow-test",
        content: JSON.stringify(payload),
        usage: {
          promptTokens: input.messages.reduce((sum, message) => sum + message.content.length, 0),
          completionTokens: 10,
          totalTokens: 10,
        },
      };
    },
  };
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

function assertOk(value: unknown) {
  if (!value) {
    throw new Error("断言失败：expected truthy value");
  }
}
