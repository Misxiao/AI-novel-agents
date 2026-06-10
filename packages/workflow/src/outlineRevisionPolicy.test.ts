import type { InitialOutlineDraft, OutlineRevisionCandidate } from "../../agents/src/index.js";
import { applyOutlineRevisionPolicy } from "./outlineRevisionPolicy.js";

testRenumbersUnconfirmedPlansContinuously();
testProtectsConfirmedChapterAndDetectsAnchorConflict();

function testRenumbersUnconfirmedPlansContinuously() {
  const source = createOutline();
  const candidate: OutlineRevisionCandidate = {
    revisedOutline: {
      ...source,
      chapterPlans: [
        source.chapterPlans[1]!,
        source.chapterPlans[0]!,
        source.chapterPlans[2]!,
      ],
    },
    diffSummary: ["交换前两章顺序"],
    impactAnalysis: emptyImpact(),
    chapterNumberChanges: [],
  };

  const result = applyOutlineRevisionPolicy({
    scope: "master",
    sourceOutline: source,
    candidate,
    protectedChapterNos: [],
  });

  assertDeepEqual(
    result.candidate.revisedOutline.chapterPlans.map((plan) => [plan.id, plan.chapterNo]),
    [
      ["chapter-plan-2", 1],
      ["chapter-plan-1", 2],
      ["chapter-plan-3", 3],
    ],
  );
  assertEqual(result.candidate.chapterNumberChanges.length, 2);
  assertEqual(result.hasCriticalConflict, false);
}

function testProtectsConfirmedChapterAndDetectsAnchorConflict() {
  const source = createOutline();
  const inserted = {
    ...source.chapterPlans[0]!,
    id: "chapter-plan-new",
    chapterNo: 99,
    title: "新增章",
  };
  const candidate: OutlineRevisionCandidate = {
    revisedOutline: {
      ...source,
      chapterPlans: [
        source.chapterPlans[0]!,
        inserted,
        {
          ...source.chapterPlans[1]!,
          chapterNo: 9,
        },
        source.chapterPlans[2]!,
      ],
    },
    diffSummary: ["在第二章前新增一章"],
    impactAnalysis: emptyImpact(),
    chapterNumberChanges: [],
  };

  const result = applyOutlineRevisionPolicy({
    scope: "master",
    sourceOutline: source,
    candidate,
    protectedChapterNos: [2],
  });

  const protectedPlan = result.candidate.revisedOutline.chapterPlans.find(
    (plan) => plan.id === "chapter-plan-2",
  );
  assertEqual(protectedPlan?.chapterNo, 2);
  assertEqual(result.hasCriticalConflict, true);
  assertOk(result.candidate.impactAnalysis.conflicts.some(
    (conflict) => conflict.category === "chapter_number_anchor_conflict",
  ));
}

function createOutline(): InitialOutlineDraft {
  const novelId = "novel-outline-policy";
  return {
    novelId,
    masterOutline: {
      opening: "开篇",
      mainGoal: "目标",
      escalation: "升级",
      climax: "高潮",
      ending: "结局",
      protagonistArc: "人物弧",
    },
    volumes: [{
      id: "volume-1",
      title: "第一卷",
      goal: "卷目标",
      conflict: "卷冲突",
      highlights: [],
      chapterRange: "1-3",
      status: "未开始",
    }],
    chapterPlans: [1, 2, 3].map((chapterNo) => ({
      id: `chapter-plan-${chapterNo}`,
      novelId,
      chapterNo,
      title: `第 ${chapterNo} 章`,
      volumeId: "volume-1",
      volumeTitle: "第一卷",
      objective: `目标 ${chapterNo}`,
      hook: `钩子 ${chapterNo}`,
      status: "草稿",
    })),
    timelineEvents: [],
    foreshadowing: [],
    issues: [],
    status: "待确认",
  };
}

function emptyImpact(): OutlineRevisionCandidate["impactAnalysis"] {
  return {
    affectedVolumeIds: [],
    affectedChapterPlanIds: [],
    affectedTimelineEventIds: [],
    affectedForeshadowingIds: [],
    structuralChanges: [],
    conflicts: [],
    idMappings: [],
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
