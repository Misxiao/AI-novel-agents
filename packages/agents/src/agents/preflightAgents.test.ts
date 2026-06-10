import type { ChatCompletionInput, ChatCompletionOutput, ChatModel } from "../core/types.js";
import { InspirationAgent } from "./inspiration/inspirationAgent.js";
import { OutlineAgent } from "./outline/outlineAgent.js";
import type { NovelFoundationDraft } from "./preflight/types.js";
import { ReviewAgent } from "./review/reviewAgent.js";
import { SettingAgent } from "./setting/settingAgent.js";

await testGeneratesAndReviewsPreflightAssets();
await testGenerationRejectsInvalidJson();
await testReviewRejectsMissingMainConflict();

async function testGeneratesAndReviewsPreflightAssets() {
  const novelId = "novel-preflight-agent-test";
  const model = createSequencedModel([
    foundationPayload(novelId),
    reviewPayload("基础盘具备可持续冲突。"),
    settingPayload(novelId),
    reviewPayload("设定边界清楚。"),
    outlinePayload(novelId),
    reviewPayload("大纲能支撑第一卷生产。"),
  ]);

  const inspiration = new InspirationAgent({ model });
  const setting = new SettingAgent({ model });
  const outline = new OutlineAgent({ model });
  const review = new ReviewAgent({ model });

  const foundation = await inspiration.generateFoundationDraft({
    novelId,
    seedNotes: "主角每次死亡都会回到三天前，但会丢失一段记忆。",
    targetWords: 360000,
  });
  const foundationReview = await review.reviewFoundation({
    novelId,
    draft: foundation.output,
  });
  const settingDraft = await setting.generateSettingDraft({
    novelId,
    seedNotes: "修真世界正在灵气枯竭。",
    foundation: foundation.output,
  });
  const settingReview = await review.reviewSetting({
    novelId,
    foundation: foundation.output,
    draft: settingDraft.output,
  });
  const outlineDraft = await outline.generateInitialOutline({
    novelId,
    foundation: foundation.output,
    setting: settingDraft.output,
    chapterPlanCount: 12,
  });
  const outlineReview = await review.reviewOutline({
    novelId,
    foundation: foundation.output,
    setting: settingDraft.output,
    draft: outlineDraft.output,
  });

  assertEqual(foundation.output.novelId, novelId);
  assertEqual(foundation.output.status, "待确认");
  assertEqual(settingDraft.output.characterSeeds.length, 2);
  assertEqual(outlineDraft.output.chapterPlans.length, 12);
  assertEqual(outlineDraft.output.chapterPlans[0]?.novelId, novelId);
  assertEqual(outlineDraft.output.chapterPlans[0]?.volumeId, "volume-1");
  assertEqual(foundationReview.output.assetKind, "foundation");
  assertEqual(settingReview.output.assetKind, "setting");
  assertEqual(outlineReview.output.assetKind, "outline");
  assertDeepEqual(
    [
      foundation.run.capabilityId,
      foundationReview.run.capabilityId,
      settingDraft.run.capabilityId,
      settingReview.run.capabilityId,
      outlineDraft.run.capabilityId,
      outlineReview.run.capabilityId,
    ],
    [
      "inspiration.generateFoundationDraft",
      "review.reviewFoundation",
      "setting.generateSettingDraft",
      "review.reviewSetting",
      "outline.generateInitialOutline",
      "review.reviewOutline",
    ],
  );
}

async function testGenerationRejectsInvalidJson() {
  const agent = new InspirationAgent({
    model: createSequencedModel(["not-json"]),
  });

  await assertRejects(
    () => agent.generateFoundationDraft({
      novelId: "novel-invalid-json",
      seedNotes: "一个模糊想法",
      targetWords: 100000,
    }),
    "InspirationAgent 模型响应不是合法 JSON",
  );
}

async function testReviewRejectsMissingMainConflict() {
  const novelId = "novel-foundation-risk";
  const review = await new ReviewAgent({
    model: createSequencedModel([reviewPayload("模型误判为可通过")]),
  }).reviewFoundation({
    novelId,
    draft: {
      ...foundationPayload(novelId),
      mainConflict: "",
      storyEngine: "",
    },
  });

  assertEqual(review.output.passed, false);
  assertOk(review.output.issues.some((issue) => issue.id === "foundation-main-conflict"));
  assertOk(review.output.issues.some((issue) => issue.id === "foundation-story-engine"));
}

function foundationPayload(novelId: string): NovelFoundationDraft {
  return {
    novelId,
    titleCandidates: ["三日前死局", "回档失忆者"],
    synopsis: "沈砚在死亡回档中用不断消失的记忆追查灭门真相。",
    hook: "每次死亡回到三日前，但会随机失去一段重要记忆。",
    sellingPoint: "死亡回档与记忆代价共同推动悬疑升级。",
    premise: "灵气枯竭时代，主角被迫重复同一场灭门。",
    mainConflict: "主角必须在彻底遗忘真相前找到幕后操盘者。",
    storyEngine: "每轮回档获得新线索，同时失去旧认知。",
    targetReaders: "喜欢玄幻升级和悬疑反转的男频读者",
    tone: "紧张、克制、行动驱动",
    targetWords: 360000,
    estimatedChapters: 120,
    estimatedVolumes: 4,
    chapterWordTarget: 3000,
    risks: [],
    questionsForAuthor: [],
    status: "待确认",
  };
}

function settingPayload(novelId: string) {
  return {
    novelId,
    background: "灵气枯竭导致宗门争夺回档遗物。",
    worldRules: ["回档只影响主角认知", "死亡后最多回到三日前"],
    powerSystem: "以记忆为燃料驱动遗物。",
    factions: ["玄衡宗", "归墟会"],
    locations: ["玄衡山门", "归墟古井"],
    constraints: ["不能无代价恢复记忆"],
    characterSeeds: [
      {
        id: "character-protagonist",
        name: "沈砚",
        role: "主角",
        desire: "阻止灭门",
        conflict: "记忆持续丢失",
        initialState: "第三次回档",
        arcHint: "从控制一切到学会信任",
      },
      {
        id: "character-rival",
        name: "陆无咎",
        role: "关键对手",
        desire: "夺取回档遗物",
        conflict: "怀疑主角知道未来",
        initialState: "潜伏宗门",
        arcHint: "从猎手变成被利用者",
      },
    ],
    relationshipSeeds: [
      {
        id: "relationship-1",
        fromCharacterId: "character-protagonist",
        toCharacterId: "character-rival",
        relation: "互相试探",
        tension: "双方都掌握不完整情报",
      },
    ],
    styleGuidance: ["短段落", "动作优先"],
    forbiddenExpressions: ["命运的齿轮开始转动"],
    canonCandidates: ["灵气正在不可逆地枯竭"],
    risks: [],
    status: "待确认",
  };
}

function outlinePayload(novelId: string) {
  return {
    novelId,
    masterOutline: {
      opening: "主角第三次从灭门前三日醒来。",
      mainGoal: "阻止灭门并找到回档源头。",
      escalation: "从宗门内鬼升级到跨宗门争夺。",
      climax: "主角主动放弃关键记忆换取最后一次回档。",
      ending: "终止回档，保留由他人记录的真相。",
      protagonistArc: "从只相信自己的记忆到学会建立可信关系。",
    },
    volumes: [
      {
        id: "volume-1",
        title: "第一卷：第三次醒来",
        goal: "识别宗门内鬼并活过灭门夜。",
        conflict: "每次试探都会改变敌方行动。",
        highlights: ["反杀第一次刺客", "发现他人也保留碎片记忆"],
        chapterRange: "1-30",
        status: "未开始",
      },
    ],
    chapterPlans: Array.from({ length: 12 }, (_, index) => ({
      id: `chapter-plan-${index + 1}`,
      novelId,
      chapterNo: index + 1,
      title: `第 ${index + 1} 章`,
      volumeId: "volume-1",
      volumeTitle: "第一卷：第三次醒来",
      objective: `推进线索 ${index + 1}`,
      hook: `留下问题 ${index + 1}`,
      status: "草稿",
    })),
    timelineEvents: [],
    foreshadowing: [],
    issues: [],
    status: "待确认",
  };
}

function reviewPayload(summary: string) {
  return {
    passed: true,
    overallScore: 88,
    summary,
    strengths: ["结构清晰"],
    issues: [],
    requiredRevisionInstruction: "",
    warnings: [],
  };
}

function createSequencedModel(payloads: unknown[]): ChatModel {
  let index = 0;
  return {
    provider: "mock",
    model: "preflight-agent-test",
    async complete(input: ChatCompletionInput): Promise<ChatCompletionOutput> {
      const payload = payloads[index++];
      if (payload === undefined) {
        throw new Error(`没有为第 ${index} 次模型调用准备 payload。`);
      }
      return {
        provider: "mock",
        model: "preflight-agent-test",
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

async function assertRejects(action: () => Promise<unknown>, expectedMessage: string) {
  try {
    await action();
  } catch (error) {
    assertEqual(error instanceof Error ? error.message : String(error), expectedMessage);
    return;
  }
  throw new Error(`断言失败：expected rejection ${expectedMessage}`);
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
