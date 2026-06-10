import type { ChatCompletionInput, ChatCompletionOutput, ChatModel } from "../../core/types.js";
import type {
  InitialOutlineDraft,
  NovelFoundationDraft,
  NovelSettingDraft,
} from "../preflight/types.js";
import { OutlineAgent } from "./outlineAgent.js";
import { ReviewAgent } from "../review/reviewAgent.js";

await testRevisesMasterOutline();
await testVolumeRevisionPreservesOtherOutlineSections();
await testRevisionRejectsInvalidJson();
await testReviewsOutlineRevision();

async function testRevisesMasterOutline() {
  const source = createSourceOutline();
  const agent = new OutlineAgent({
    model: createSequencedModel([{
      revisedOutline: {
        ...source,
        masterOutline: {
          ...source.masterOutline,
          escalation: "冲突由城内追捕升级为两界战争。",
        },
      },
      diffSummary: ["扩大中段冲突规模"],
      impactAnalysis: {
        affectedVolumeIds: ["volume-2"],
        affectedChapterPlanIds: ["chapter-plan-3"],
        affectedTimelineEventIds: [],
        affectedForeshadowingIds: [],
        structuralChanges: ["第二卷升级为两界战争"],
        conflicts: [],
        idMappings: [],
      },
      chapterNumberChanges: [],
    }]),
  });

  const result = await agent.reviseMasterOutline({
    novelId: source.novelId,
    instruction: "把中段冲突升级为两界战争。",
    foundation: createFoundation(),
    setting: createSetting(),
    sourceOutline: source,
    protectedChapterPlans: [source.chapterPlans[0]!],
  });

  assertEqual(result.run.capabilityId, "outline.reviseMasterOutline");
  assertEqual(result.output.revisedOutline.novelId, source.novelId);
  assertEqual(result.output.diffSummary[0], "扩大中段冲突规模");
}

async function testVolumeRevisionPreservesOtherOutlineSections() {
  const source = createSourceOutline();
  const maliciousCandidate = {
    ...source,
    masterOutline: {
      ...source.masterOutline,
      ending: "模型擅自改掉结局。",
    },
    volumes: [
      {
        ...source.volumes[0],
        goal: "模型擅自改掉第一卷。",
      },
      {
        ...source.volumes[1],
        goal: "第二卷改为营救失踪盟友。",
      },
    ],
  };
  const agent = new OutlineAgent({
    model: createSequencedModel([{
      revisedOutline: maliciousCandidate,
      diffSummary: ["修改第二卷营救目标"],
      impactAnalysis: {
        affectedVolumeIds: ["volume-2"],
        affectedChapterPlanIds: ["chapter-plan-3"],
        affectedTimelineEventIds: [],
        affectedForeshadowingIds: [],
        structuralChanges: [],
        conflicts: [],
        idMappings: [],
      },
      chapterNumberChanges: [],
    }]),
  });

  const result = await agent.reviseVolumeOutline({
    novelId: source.novelId,
    volumeId: "volume-2",
    instruction: "第二卷改为营救失踪盟友。",
    foundation: createFoundation(),
    setting: createSetting(),
    sourceOutline: source,
    protectedChapterPlans: [],
  });

  assertDeepEqual(result.output.revisedOutline.masterOutline, source.masterOutline);
  assertDeepEqual(result.output.revisedOutline.volumes[0], source.volumes[0]);
  assertEqual(result.output.revisedOutline.volumes[1]?.goal, "第二卷改为营救失踪盟友。");
  assertEqual(
    result.output.impactAnalysis.conflicts.some((conflict) =>
      conflict.category === "master_outline_overreach"
    ),
    true,
  );
  assertEqual(result.run.capabilityId, "outline.reviseVolumeOutline");
}

async function testRevisionRejectsInvalidJson() {
  const source = createSourceOutline();
  const agent = new OutlineAgent({
    model: createSequencedModel(["not-json"]),
  });

  await assertRejects(
    () => agent.reviseMasterOutline({
      novelId: source.novelId,
      instruction: "调整结局。",
      foundation: createFoundation(),
      setting: createSetting(),
      sourceOutline: source,
      protectedChapterPlans: [],
    }),
    "OutlineAgent 模型响应不是合法 JSON",
  );
}

async function testReviewsOutlineRevision() {
  const source = createSourceOutline();
  const review = await new ReviewAgent({
    model: createSequencedModel([{
      passed: true,
      overallScore: 91,
      summary: "修改范围清楚。",
      strengths: ["未破坏既有结构"],
      issues: [],
      requiredRevisionInstruction: "",
      warnings: [],
    }]),
  }).reviewOutlineRevision({
    novelId: source.novelId,
    scope: "master",
    foundation: createFoundation(),
    setting: createSetting(),
    sourceOutline: source,
    candidate: {
      revisedOutline: source,
      diffSummary: ["收紧开篇"],
      impactAnalysis: {
        affectedVolumeIds: ["volume-1"],
        affectedChapterPlanIds: [],
        affectedTimelineEventIds: [],
        affectedForeshadowingIds: [],
        structuralChanges: [],
        conflicts: [],
        idMappings: [],
      },
      chapterNumberChanges: [],
    },
  });

  assertEqual(review.run.capabilityId, "review.reviewOutlineRevision");
  assertEqual(review.output.passed, true);
}

function createSourceOutline(): InitialOutlineDraft {
  const novelId = "novel-outline-revision-agent";
  return {
    novelId,
    masterOutline: {
      opening: "主角从死局中醒来。",
      mainGoal: "找到灾难源头。",
      escalation: "从城内追捕升级到宗门战争。",
      climax: "主角付出记忆代价封印裂缝。",
      ending: "裂缝关闭，但异界仍留下信标。",
      protagonistArc: "从独行者成长为组织者。",
    },
    volumes: [
      {
        id: "volume-1",
        title: "第一卷",
        goal: "逃出封锁城。",
        conflict: "追兵封锁出口。",
        highlights: ["夜袭城门"],
        chapterRange: "1-2",
        status: "未开始",
      },
      {
        id: "volume-2",
        title: "第二卷",
        goal: "联合宗门反攻。",
        conflict: "盟友互不信任。",
        highlights: ["宗门会盟"],
        chapterRange: "3-4",
        status: "未开始",
      },
    ],
    chapterPlans: [
      chapterPlan(novelId, 1, "volume-1", "第一卷"),
      chapterPlan(novelId, 2, "volume-1", "第一卷"),
      chapterPlan(novelId, 3, "volume-2", "第二卷"),
      chapterPlan(novelId, 4, "volume-2", "第二卷"),
    ],
    timelineEvents: [],
    foreshadowing: [],
    issues: [],
    status: "待确认",
  };
}

function chapterPlan(novelId: string, chapterNo: number, volumeId: string, volumeTitle: string) {
  return {
    id: `chapter-plan-${chapterNo}`,
    novelId,
    chapterNo,
    title: `第 ${chapterNo} 章`,
    volumeId,
    volumeTitle,
    objective: `推进事件 ${chapterNo}`,
    hook: `留下悬念 ${chapterNo}`,
    status: "草稿",
  };
}

function createFoundation(): NovelFoundationDraft {
  return {
    novelId: "novel-outline-revision-agent",
    titleCandidates: ["裂界回声"],
    synopsis: "主角追查裂界灾难。",
    hook: "每次封印都会失去一段记忆。",
    sellingPoint: "代价升级与群像协作。",
    premise: "城市被异界裂缝封锁。",
    mainConflict: "主角必须在失忆前关闭裂缝。",
    storyEngine: "每次行动揭开更大的幕后结构。",
    targetReaders: "玄幻读者",
    tone: "紧张",
    targetWords: 300000,
    estimatedChapters: 100,
    estimatedVolumes: 4,
    chapterWordTarget: 3000,
    risks: [],
    questionsForAuthor: [],
    status: "待确认",
  };
}

function createSetting(): NovelSettingDraft {
  return {
    novelId: "novel-outline-revision-agent",
    background: "裂界正在侵蚀城市。",
    worldRules: ["封印需要记忆作为代价"],
    factions: [],
    locations: [],
    constraints: [],
    characterSeeds: [],
    relationshipSeeds: [],
    styleGuidance: [],
    forbiddenExpressions: [],
    canonCandidates: [],
    risks: [],
    status: "待确认",
  };
}

function createSequencedModel(payloads: unknown[]): ChatModel {
  let index = 0;
  return {
    provider: "mock",
    model: "outline-revision-agent-test",
    async complete(input: ChatCompletionInput): Promise<ChatCompletionOutput> {
      const payload = payloads[index++];
      if (payload === undefined) {
        throw new Error(`没有为第 ${index} 次模型调用准备 payload。`);
      }
      return {
        provider: "mock",
        model: "outline-revision-agent-test",
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
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`断言失败：expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
