import {
  InspirationAgent,
  OutlineAgent,
  ReviewAgent,
  SettingAgent,
  type AgentCapabilityRunMeta,
  type ChatModel,
  type InitialOutlineDraft,
  type NovelFoundationDraft,
  type NovelSettingDraft,
  type PreflightReviewOutput,
} from "../../agents/src/index.js";
import {
  NovelPreflightRepository,
  type NovelPreflightRepositoryLike,
} from "../../repositories/src/index.js";

export interface NovelPreflightWorkflowInput {
  novelId: string;
  seedNotes: string;
  targetWords?: number;
  chapterPlanCount?: number;
  model?: ChatModel;
  repository?: NovelPreflightRepositoryLike;
}

export interface NovelPreflightWorkflowResult {
  task: {
    taskId: string;
    novelId: string;
    title: string;
    workflowName: "novel-preflight";
    status: "waiting_for_user" | "failed";
    inputSnapshot: string;
    outputSnapshot: string;
    error?: string;
    startedAt: string;
    finishedAt: string;
  };
  foundationDraft: NovelFoundationDraft;
  settingDraft: NovelSettingDraft;
  outlineDraft: InitialOutlineDraft;
  reviews: {
    foundation: PreflightReviewOutput;
    setting: PreflightReviewOutput;
    outline: PreflightReviewOutput;
  };
  chapterPlans: InitialOutlineDraft["chapterPlans"];
  agentRuns: AgentCapabilityRunMeta[];
}

export async function runNovelPreflightWorkflow(
  input: NovelPreflightWorkflowInput,
): Promise<NovelPreflightWorkflowResult> {
  assertInput(input);
  const repository = input.repository ?? new NovelPreflightRepository();
  const novel = repository.getNovel(input.novelId);
  if (!novel) {
    throw new Error(`未找到小说项目：${input.novelId}`);
  }

  const startedAt = new Date().toISOString();
  const taskId = `task-novel-preflight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inputSnapshot = `novel-preflight：${input.seedNotes.trim().slice(0, 120)}；目标字数：${input.targetWords ?? "未指定"}`;
  const inspirationAgent = new InspirationAgent({ model: input.model });
  const settingAgent = new SettingAgent({ model: input.model });
  const outlineAgent = new OutlineAgent({ model: input.model });
  const reviewAgent = new ReviewAgent({ model: input.model });
  const agentRuns: AgentCapabilityRunMeta[] = [];

  try {
    const foundationResult = await inspirationAgent.generateFoundationDraft({
      novelId: input.novelId,
      seedNotes: input.seedNotes,
      targetWords: input.targetWords,
    });
    agentRuns.push(foundationResult.run);

    const foundationReview = await reviewAgent.reviewFoundation({
      novelId: input.novelId,
      draft: foundationResult.output,
    });
    agentRuns.push(foundationReview.run);
    const foundationDraft: NovelFoundationDraft = {
      ...foundationResult.output,
      status: resolvePreflightAssetStatus(foundationReview.output),
    };

    const settingResult = await settingAgent.generateSettingDraft({
      novelId: input.novelId,
      seedNotes: input.seedNotes,
      foundation: foundationDraft,
    });
    agentRuns.push(settingResult.run);

    const settingReview = await reviewAgent.reviewSetting({
      novelId: input.novelId,
      foundation: foundationDraft,
      draft: settingResult.output,
    });
    agentRuns.push(settingReview.run);
    const settingDraft: NovelSettingDraft = {
      ...settingResult.output,
      status: resolvePreflightAssetStatus(settingReview.output),
    };

    const outlineResult = await outlineAgent.generateInitialOutline({
      novelId: input.novelId,
      foundation: foundationDraft,
      setting: settingDraft,
      chapterPlanCount: input.chapterPlanCount,
    });
    agentRuns.push(outlineResult.run);

    const outlineReview = await reviewAgent.reviewOutline({
      novelId: input.novelId,
      foundation: foundationDraft,
      setting: settingDraft,
      draft: outlineResult.output,
    });
    agentRuns.push(outlineReview.run);
    const outlineDraft: InitialOutlineDraft = {
      ...outlineResult.output,
      status: resolvePreflightAssetStatus(outlineReview.output),
    };

    repository.saveDraft({
      novelId: input.novelId,
      kind: "foundation",
      status: foundationDraft.status,
      asset: foundationDraft,
    });
    repository.saveDraft({
      novelId: input.novelId,
      kind: "setting",
      status: settingDraft.status,
      asset: settingDraft,
    });
    repository.saveDraft({
      novelId: input.novelId,
      kind: "outline",
      status: outlineDraft.status,
      asset: outlineDraft,
    });

    const finishedAt = new Date().toISOString();
    const outputSnapshot = [
      `基础盘：${foundationReview.output.overallScore} 分`,
      `设定：${settingReview.output.overallScore} 分`,
      `大纲：${outlineReview.output.overallScore} 分`,
      `首批章纲：${outlineResult.output.chapterPlans.length} 章`,
      [foundationDraft, settingDraft, outlineDraft].some(
        (draft) => draft.status === "需修订",
      )
        ? "存在需修订资产"
        : "等待用户确认",
    ].join("；");
    const task = repository.saveTask({
      taskId,
      novelId: input.novelId,
      title: "生成小说前置资产",
      workflowName: "novel-preflight",
      status: "waiting_for_user",
      inputSnapshot,
      outputSnapshot,
      startedAt,
      finishedAt,
    });

    return {
      task: {
        ...task,
        workflowName: "novel-preflight",
        status: "waiting_for_user",
        finishedAt: task.finishedAt ?? finishedAt,
      },
      foundationDraft,
      settingDraft,
      outlineDraft,
      reviews: {
        foundation: foundationReview.output,
        setting: settingReview.output,
        outline: outlineReview.output,
      },
      chapterPlans: outlineDraft.chapterPlans,
      agentRuns,
    };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    repository.saveTask({
      taskId,
      novelId: input.novelId,
      title: "生成小说前置资产",
      workflowName: "novel-preflight",
      status: "failed",
      inputSnapshot,
      outputSnapshot: "小说前置资产生成失败。",
      error: error instanceof Error ? error.message : String(error),
      startedAt,
      finishedAt,
    });
    throw error;
  }
}

export function resolvePreflightAssetStatus(review: {
  passed: boolean;
  overallScore: number;
  issues: Array<{ severity: string }>;
}): "待确认" | "需修订" {
  return review.passed
    && review.overallScore >= 85
    && !review.issues.some((issue) => issue.severity === "critical")
    ? "待确认"
    : "需修订";
}

function assertInput(input: NovelPreflightWorkflowInput) {
  if (!input.novelId.trim()) {
    throw new Error("novelId 不能为空");
  }
  if (!input.seedNotes.trim()) {
    throw new Error("seedNotes 不能为空");
  }
  if (input.targetWords !== undefined && (!Number.isFinite(input.targetWords) || input.targetWords <= 0)) {
    throw new Error("targetWords 必须为正数");
  }
}
