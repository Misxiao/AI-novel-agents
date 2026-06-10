import type { ChatCompletionInput, ChatCompletionOutput, ChatModel } from "../../agents/src/index.js";
import { NovelDatabase } from "../../db/src/index.js";
import {
  ChapterProductionRepository,
  NovelPreflightRepository,
} from "../../repositories/src/index.js";
import {
  runReviseMasterOutlineWorkflow,
  runReviseVolumeOutlineWorkflow,
  type OutlineRevisionVersion,
} from "./outlineRevision.js";

await testCreatesIndependentRevisionVersion();
await testLatestVersionBecomesDefaultSource();
await testProtectedChapterDeletionNeedsRevision();
await testModelFailureDoesNotSaveVersion();

async function testCreatesIndependentRevisionVersion() {
  const fixture = createFixture("independent");
  const candidate = createRevisionPayload(fixture.novelId, "扩大第二卷冲突");
  const result = await runReviseMasterOutlineWorkflow({
    novelId: fixture.novelId,
    instruction: "扩大第二卷冲突",
    model: createSequencedModel([candidate, reviewPayload(90)]),
    repository: fixture.repository,
  });

  assertEqual(result.task.status, "waiting_for_user");
  assertEqual(result.version.status, "待确认");
  assertEqual(result.version.revisedOutline.novelId, fixture.novelId);
  assertEqual(fixture.repository.listOutlineVersions(fixture.novelId).length, 1);
  assertDeepEqual(
    fixture.repository.getDraft(fixture.novelId, "outline")?.asset,
    fixture.sourceOutline,
  );
  assertDeepEqual(
    result.agentRuns.map((run) => run.capabilityId),
    ["outline.reviseMasterOutline", "review.reviewOutlineRevision"],
  );

  const production = new ChapterProductionRepository(fixture.db)
    .assembleChapterProductionContext({ novelId: fixture.novelId, chapterNo: 1 });
  assertOk(production.missingAssets.includes("outline"));
}

async function testLatestVersionBecomesDefaultSource() {
  const fixture = createFixture("latest");
  const first = await runReviseMasterOutlineWorkflow({
    novelId: fixture.novelId,
    instruction: "第一次修改",
    model: createSequencedModel([
      createRevisionPayload(fixture.novelId, "第一次修改"),
      reviewPayload(90),
    ]),
    repository: fixture.repository,
  });
  const secondPayload = createRevisionPayload(fixture.novelId, "第二次修改");
  secondPayload.revisedOutline.masterOutline.ending = "第二版结局";
  const second = await runReviseVolumeOutlineWorkflow({
    novelId: fixture.novelId,
    volumeId: "volume-2",
    instruction: "第二次修改",
    model: createSequencedModel([secondPayload, reviewPayload(90)]),
    repository: fixture.repository,
  });

  assertEqual(second.version.sourceVersionId, first.version.versionId);
  assertEqual(fixture.repository.listOutlineVersions(fixture.novelId).length, 2);

  const explicit = await runReviseMasterOutlineWorkflow({
    novelId: fixture.novelId,
    sourceVersionId: first.version.versionId,
    instruction: "从第一版分叉",
    model: createSequencedModel([
      createRevisionPayload(fixture.novelId, "从第一版分叉"),
      reviewPayload(90),
    ]),
    repository: fixture.repository,
  });
  assertEqual(explicit.version.sourceVersionId, first.version.versionId);
  assertEqual(fixture.repository.listOutlineVersions(fixture.novelId).length, 3);
}

async function testProtectedChapterDeletionNeedsRevision() {
  const fixture = createFixture("protected");
  fixture.db.saveChapterContext({
    novelId: fixture.novelId,
    chapterNo: 1,
    title: "第一章",
    summary: "已确认章节",
    content: "正文",
    status: "confirmed",
  });
  const payload = createRevisionPayload(fixture.novelId, "删除第一卷");
  payload.revisedOutline.volumes = payload.revisedOutline.volumes.filter(
    (volume) => volume.id !== "volume-1",
  );
  payload.revisedOutline.chapterPlans = payload.revisedOutline.chapterPlans.filter(
    (plan) => plan.volumeId !== "volume-1",
  );

  const result = await runReviseMasterOutlineWorkflow({
    novelId: fixture.novelId,
    instruction: "删除第一卷",
    model: createSequencedModel([payload, reviewPayload(95)]),
    repository: fixture.repository,
  });

  assertEqual(result.version.status, "需修订");
  assertEqual(result.version.revisedOutline.status, "需修订");
  assertOk(result.version.impactAnalysis.conflicts.some(
    (conflict) => conflict.category === "protected_chapter",
  ));
}

async function testModelFailureDoesNotSaveVersion() {
  const fixture = createFixture("failure");
  try {
    await runReviseMasterOutlineWorkflow({
      novelId: fixture.novelId,
      instruction: "触发非法输出",
      model: createSequencedModel(["not-json"]),
      repository: fixture.repository,
    });
  } catch {
    assertEqual(fixture.repository.listOutlineVersions(fixture.novelId).length, 0);
    assertEqual(fixture.db.listTasks(fixture.novelId)[0]?.status, "failed");
    return;
  }
  throw new Error("断言失败：非法 JSON 应导致修改 Workflow 失败");
}

function createFixture(suffix: string) {
  const dbPath = `/private/tmp/ai-novel-outline-revision-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
  const db = new NovelDatabase(dbPath);
  const repository = new NovelPreflightRepository(db);
  const novelId = repository.createEmptyNovel().novelId;
  const sourceOutline = createOutline(novelId);
  repository.saveDraft({
    novelId,
    kind: "foundation",
    status: "待确认",
    asset: createFoundation(novelId),
  });
  repository.saveDraft({
    novelId,
    kind: "setting",
    status: "待确认",
    asset: createSetting(novelId),
  });
  repository.saveDraft({
    novelId,
    kind: "outline",
    status: "待确认",
    asset: sourceOutline,
  });
  return { db, repository, novelId, sourceOutline };
}

function createRevisionPayload(novelId: string, summary: string) {
  const outline = createOutline(novelId);
  outline.volumes[1]!.conflict = summary;
  return {
    revisedOutline: outline,
    diffSummary: [summary],
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
  };
}

function createOutline(novelId: string) {
  return {
    novelId,
    masterOutline: {
      opening: "开篇",
      mainGoal: "总目标",
      escalation: "升级",
      climax: "高潮",
      ending: "结局",
      protagonistArc: "人物弧",
    },
    volumes: ["第一卷", "第二卷"].map((title, index) => ({
      id: `volume-${index + 1}`,
      title,
      goal: `卷目标 ${index + 1}`,
      conflict: `卷冲突 ${index + 1}`,
      highlights: [],
      chapterRange: index === 0 ? "1-2" : "3-4",
      status: "未开始" as const,
    })),
    chapterPlans: [1, 2, 3, 4].map((chapterNo) => ({
      id: `chapter-plan-${chapterNo}`,
      novelId,
      chapterNo,
      title: `第 ${chapterNo} 章`,
      volumeId: chapterNo <= 2 ? "volume-1" : "volume-2",
      volumeTitle: chapterNo <= 2 ? "第一卷" : "第二卷",
      objective: `目标 ${chapterNo}`,
      hook: `钩子 ${chapterNo}`,
      status: "草稿",
    })),
    timelineEvents: [],
    foreshadowing: [],
    issues: [],
    status: "待确认" as const,
  };
}

function createFoundation(novelId: string) {
  return {
    novelId,
    titleCandidates: ["测试小说"],
    synopsis: "简介",
    hook: "钩子",
    sellingPoint: "卖点",
    premise: "前提",
    mainConflict: "冲突",
    storyEngine: "引擎",
    targetReaders: "读者",
    tone: "基调",
    targetWords: 100000,
    estimatedChapters: 40,
    estimatedVolumes: 2,
    chapterWordTarget: 2500,
    risks: [],
    questionsForAuthor: [],
    status: "待确认" as const,
  };
}

function createSetting(novelId: string) {
  return {
    novelId,
    background: "背景",
    worldRules: ["规则"],
    factions: [],
    locations: [],
    constraints: [],
    characterSeeds: [],
    relationshipSeeds: [],
    styleGuidance: [],
    forbiddenExpressions: [],
    canonCandidates: [],
    risks: [],
    status: "待确认" as const,
  };
}

function reviewPayload(score: number) {
  return {
    passed: true,
    overallScore: score,
    summary: "修改可用",
    strengths: [],
    issues: [],
    requiredRevisionInstruction: "",
    warnings: [],
  };
}

function createSequencedModel(payloads: unknown[]): ChatModel {
  let index = 0;
  return {
    provider: "mock",
    model: "outline-revision-workflow-test",
    async complete(input: ChatCompletionInput): Promise<ChatCompletionOutput> {
      const payload = payloads[index++];
      if (payload === undefined) {
        throw new Error(`没有为第 ${index} 次模型调用准备 payload。`);
      }
      return {
        provider: "mock",
        model: "outline-revision-workflow-test",
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

function assertOk(value: unknown) {
  if (!value) {
    throw new Error("断言失败：expected truthy value");
  }
}
