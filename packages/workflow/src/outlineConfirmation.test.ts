import { NovelDatabase } from "../../db/src/index.js";
import {
  ChapterProductionRepository,
  NovelPreflightRepository,
} from "../../repositories/src/index.js";
import {
  runConfirmOutlineWorkflow,
  type OutlineRevisionVersion,
} from "./index.js";

const dbPath = `/private/tmp/ai-novel-outline-confirmation-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const db = new NovelDatabase(dbPath);
const repository = new NovelPreflightRepository(db);
const novel = repository.createEmptyNovel();

savePreflightDrafts(novel.novelId);

const confirmed = await runConfirmOutlineWorkflow({
  novelId: novel.novelId,
  title: "裂界回声",
  repository,
});

assertEqual(confirmed.task.status, "succeeded");
assertEqual(confirmed.source, "preflight");
assertEqual(repository.getDraft(novel.novelId, "foundation")?.status, "已确认");
assertEqual(repository.getDraft(novel.novelId, "setting")?.status, "已确认");
assertEqual(repository.getDraft(novel.novelId, "outline")?.status, "已确认");

const storedNovel = db.getNovel(novel.novelId);
assertEqual(storedNovel?.title, "裂界回声");
assertEqual(storedNovel?.stage, "大纲");
assertEqual(storedNovel?.targetWords, 120000);
assertEqual(storedNovel?.totalChapters, 48);
assertEqual(storedNovel?.currentVolume, "第一卷：旧城裂口");

const formal = db.getOutlineResult<{
  status: string;
  baseline: { mainConflict: string };
  setting: { worldRules: string[] };
}>(novel.novelId);
assertEqual(formal?.outline.status, "已确认");
assertEqual(formal?.outline.baseline.mainConflict, "在失忆前关闭裂界");
assertEqual(formal?.outline.setting.worldRules[0], "封印必须支付记忆");
assertEqual(formal?.chapterPlans[0]?.status, "已确认");

const chapterAssets = new ChapterProductionRepository(db)
  .assembleChapterProductionContext({ novelId: novel.novelId, chapterNo: 1 });
assertEqual(chapterAssets.missingAssets.length, 0);
assertEqual(chapterAssets.context.worldRules?.[0], "封印必须支付记忆");
assertEqual(chapterAssets.context.styleGuidance?.includes("短段落"), true);
assertEqual(
  chapterAssets.context.forbiddenExpressions?.includes("命运的齿轮开始转动"),
  true,
);

const version = createRevisionVersion(novel.novelId, "待确认", "修改后的卷目标");
repository.saveOutlineVersion({
  novelId: novel.novelId,
  versionId: version.versionId,
  status: version.status,
  scope: version.scope,
  version,
  createdAt: version.createdAt,
});

const confirmedVersion = await runConfirmOutlineWorkflow({
  novelId: novel.novelId,
  versionId: version.versionId,
  repository,
});
assertEqual(confirmedVersion.source, "revision");
assertEqual(confirmedVersion.versionId, version.versionId);
assertEqual(
  db.getOutlineResult<{ volumes: Array<{ goal: string }> }>(novel.novelId)
    ?.outline.volumes[0]?.goal,
  "修改后的卷目标",
);
assertEqual(
  repository.getOutlineVersion<OutlineRevisionVersion>(
    novel.novelId,
    version.versionId,
  )?.status,
  "已确认",
);

const rejected = createRevisionVersion(novel.novelId, "需修订", "不能确认");
repository.saveOutlineVersion({
  novelId: novel.novelId,
  versionId: rejected.versionId,
  status: rejected.status,
  scope: rejected.scope,
  version: rejected,
  createdAt: rejected.createdAt,
});
await assertRejects(
  () => runConfirmOutlineWorkflow({
    novelId: novel.novelId,
    versionId: rejected.versionId,
    repository,
  }),
  "大纲版本仍需修订，不能确认",
);

repository.saveDraft({
  novelId: novel.novelId,
  kind: "setting",
  status: "需修订",
  asset: {
    ...repository.getDraft<Record<string, unknown>>(novel.novelId, "setting")?.asset,
    novelId: novel.novelId,
    status: "需修订",
  },
});
await assertRejects(
  () => runConfirmOutlineWorkflow({
    novelId: novel.novelId,
    versionId: version.versionId,
    repository,
  }),
  "setting 前置资产仍需修订",
);

function savePreflightDrafts(novelId: string) {
  repository.saveDraft({
    novelId,
    kind: "foundation",
    status: "待确认",
    asset: {
      novelId,
      titleCandidates: ["裂界回声", "失忆封印者"],
      synopsis: "沈砚必须在记忆耗尽前关闭裂界。",
      hook: "每次封印都会永久失去记忆。",
      sellingPoint: "封印代价与真相追查同步升级。",
      premise: "城市被裂界封锁。",
      mainConflict: "在失忆前关闭裂界",
      storyEngine: "处理裂界获得线索，同时失去记忆。",
      targetReaders: "玄幻悬疑读者",
      tone: "紧张克制",
      targetWords: 120000,
      estimatedChapters: 48,
      estimatedVolumes: 3,
      chapterWordTarget: 2500,
      risks: [],
      questionsForAuthor: [],
      status: "待确认",
    },
  });
  repository.saveDraft({
    novelId,
    kind: "setting",
    status: "待确认",
    asset: {
      novelId,
      background: "裂界吞噬旧城。",
      worldRules: ["封印必须支付记忆"],
      powerSystem: "记忆化作封印纹路。",
      factions: ["守界司"],
      locations: ["旧城裂界"],
      constraints: ["失去的记忆不能无代价恢复"],
      characterSeeds: [],
      relationshipSeeds: [],
      styleGuidance: ["短段落", "动作优先"],
      forbiddenExpressions: ["命运的齿轮开始转动"],
      canonCandidates: ["封印必然消耗记忆"],
      risks: [],
      status: "待确认",
    },
  });
  repository.saveDraft({
    novelId,
    kind: "outline",
    status: "待确认",
    asset: createOutline(novelId, "关闭旧城裂界"),
  });
}

function createRevisionVersion(
  novelId: string,
  status: "待确认" | "需修订",
  volumeGoal: string,
): OutlineRevisionVersion {
  const versionId = `outline-version-${status}-${Date.now()}`;
  return {
    versionId,
    novelId,
    scope: "master",
    instruction: "修改第一卷目标",
    revisedOutline: createOutline(novelId, volumeGoal),
    diffSummary: ["修改第一卷目标"],
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
    review: {
      reviewId: "review-version",
      novelId,
      assetKind: "outline",
      passed: status === "待确认",
      overallScore: status === "待确认" ? 90 : 70,
      summary: "版本评审",
      strengths: [],
      issues: [],
      requiredRevisionInstruction: "",
      warnings: [],
      provider: "mock",
      model: "mock",
      createdAt: new Date().toISOString(),
    },
    status,
    createdAt: new Date().toISOString(),
    agentRuns: [],
  };
}

function createOutline(novelId: string, volumeGoal: string) {
  return {
    novelId,
    masterOutline: {
      opening: "旧城裂界失控。",
      mainGoal: "关闭裂界。",
      escalation: "裂界连锁扩张。",
      climax: "封住裂界核心。",
      ending: "城市恢复。",
      protagonistArc: "从独行到信任盟友。",
    },
    volumes: [{
      id: "volume-1",
      title: "第一卷：旧城裂口",
      goal: volumeGoal,
      conflict: "守界司隐瞒真相。",
      highlights: ["首次封印"],
      chapterRange: "1-10",
      status: "未开始" as const,
    }],
    chapterPlans: [{
      id: "chapter-plan-1",
      novelId,
      chapterNo: 1,
      title: "裂界门前",
      volumeId: "volume-1",
      volumeTitle: "第一卷：旧城裂口",
      objective: "主角第一次主动试探裂界。",
      hook: "门后出现失踪盟友的血字。",
      status: "待确认",
    }],
    timelineEvents: [],
    foreshadowing: [],
    issues: [],
    status: "待确认" as const,
  };
}

async function assertRejects(
  action: () => Promise<unknown>,
  expectedMessage: string,
) {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(expectedMessage)) return;
    throw new Error(`断言失败：expected ${expectedMessage}, got ${message}`);
  }
  throw new Error(`断言失败：expected rejection ${expectedMessage}`);
}

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`断言失败：expected ${String(expected)}, got ${String(actual)}`);
  }
}
