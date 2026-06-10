import {
  OutlineAgent,
  ReviewAgent,
  type AgentCapabilityRunMeta,
  type ChatModel,
  type InitialOutlineDraft,
  type NovelFoundationDraft,
  type NovelSettingDraft,
  type OutlineRevisionImpactAnalysis,
  type OutlineRevisionScope,
  type PreflightReviewOutput,
} from "../../agents/src/index.js";
import {
  NovelPreflightRepository,
  type NovelPreflightRepositoryLike,
} from "../../repositories/src/index.js";
import { applyOutlineRevisionPolicy } from "./outlineRevisionPolicy.js";

export type OutlineRevisionVersionStatus = "待确认" | "需修订" | "已确认";

export interface OutlineRevisionVersion {
  versionId: string;
  sourceVersionId?: string;
  novelId: string;
  scope: OutlineRevisionScope;
  targetVolumeId?: string;
  instruction: string;
  revisedOutline: InitialOutlineDraft;
  diffSummary: string[];
  impactAnalysis: OutlineRevisionImpactAnalysis;
  chapterNumberChanges: Array<{
    chapterPlanId: string;
    from: number;
    to: number;
  }>;
  review: PreflightReviewOutput;
  status: OutlineRevisionVersionStatus;
  createdAt: string;
  agentRuns: AgentCapabilityRunMeta[];
}

export interface ReviseMasterOutlineWorkflowInput {
  novelId: string;
  instruction: string;
  sourceVersionId?: string;
  model?: ChatModel;
  repository?: NovelPreflightRepositoryLike;
}

export interface ReviseVolumeOutlineWorkflowInput
  extends ReviseMasterOutlineWorkflowInput {
  volumeId: string;
}

export interface OutlineRevisionWorkflowResult {
  task: {
    taskId: string;
    novelId: string;
    title: string;
    workflowName: "revise-master-outline" | "revise-volume-outline";
    status: "waiting_for_user" | "failed";
    inputSnapshot: string;
    outputSnapshot: string;
    error?: string;
    startedAt: string;
    finishedAt: string;
  };
  version: OutlineRevisionVersion;
  agentRuns: AgentCapabilityRunMeta[];
}

export async function runReviseMasterOutlineWorkflow(
  input: ReviseMasterOutlineWorkflowInput,
): Promise<OutlineRevisionWorkflowResult> {
  return runOutlineRevisionWorkflow("master", input);
}

export async function runReviseVolumeOutlineWorkflow(
  input: ReviseVolumeOutlineWorkflowInput,
): Promise<OutlineRevisionWorkflowResult> {
  return runOutlineRevisionWorkflow("volume", input);
}

async function runOutlineRevisionWorkflow(
  scope: OutlineRevisionScope,
  input: ReviseMasterOutlineWorkflowInput | ReviseVolumeOutlineWorkflowInput,
): Promise<OutlineRevisionWorkflowResult> {
  assertInput(scope, input);
  const repository = input.repository ?? new NovelPreflightRepository();
  if (!repository.getNovel(input.novelId)) {
    throw new Error(`未找到小说项目：${input.novelId}`);
  }

  const startedAt = new Date().toISOString();
  const workflowName = scope === "master"
    ? "revise-master-outline"
    : "revise-volume-outline";
  const title = scope === "master" ? "修改小说总纲" : "修改小说卷纲";
  const taskId = `task-${workflowName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inputSnapshot = [
    `范围：${scope}`,
    scope === "volume"
      ? `目标卷：${(input as ReviseVolumeOutlineWorkflowInput).volumeId}`
      : "",
    `指令：${input.instruction.trim().slice(0, 160)}`,
    input.sourceVersionId ? `源版本：${input.sourceVersionId}` : "",
  ].filter(Boolean).join("；");

  try {
    const foundation = requireDraft<NovelFoundationDraft>(repository, input.novelId, "foundation");
    const setting = requireDraft<NovelSettingDraft>(repository, input.novelId, "setting");
    const source = resolveSourceOutline(repository, input.novelId, input.sourceVersionId);
    const protectedChapterNos = repository
      .listConfirmedChapterContexts(input.novelId)
      .map((chapter) => chapter.chapterNo);
    const protectedChapterPlans = source.outline.chapterPlans.filter((plan) =>
      protectedChapterNos.includes(plan.chapterNo)
    );
    const outlineAgent = new OutlineAgent({ model: input.model });
    const reviewAgent = new ReviewAgent({ model: input.model });

    const revisionResult = scope === "master"
      ? await outlineAgent.reviseMasterOutline({
          novelId: input.novelId,
          instruction: input.instruction,
          foundation,
          setting,
          sourceOutline: source.outline,
          protectedChapterPlans,
        })
      : await outlineAgent.reviseVolumeOutline({
          novelId: input.novelId,
          volumeId: (input as ReviseVolumeOutlineWorkflowInput).volumeId,
          instruction: input.instruction,
          foundation,
          setting,
          sourceOutline: source.outline,
          protectedChapterPlans,
        });

    const policyResult = applyOutlineRevisionPolicy({
      scope,
      ...(scope === "volume"
        ? { targetVolumeId: (input as ReviseVolumeOutlineWorkflowInput).volumeId }
        : {}),
      sourceOutline: source.outline,
      candidate: revisionResult.output,
      protectedChapterNos,
    });
    const reviewResult = await reviewAgent.reviewOutlineRevision({
      novelId: input.novelId,
      scope,
      ...(scope === "volume"
        ? { targetVolumeId: (input as ReviseVolumeOutlineWorkflowInput).volumeId }
        : {}),
      foundation,
      setting,
      sourceOutline: source.outline,
      candidate: policyResult.candidate,
    });
    const agentRuns = [revisionResult.run, reviewResult.run];
    const hasCritical = policyResult.hasCriticalConflict
      || reviewResult.output.issues.some((issue) => issue.severity === "critical");
    const status: OutlineRevisionVersionStatus = !hasCritical
      && reviewResult.output.overallScore >= 85
      ? "待确认"
      : "需修订";
    const createdAt = new Date().toISOString();
    const versionId = `outline-version-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const version: OutlineRevisionVersion = {
      versionId,
      ...(source.versionId ? { sourceVersionId: source.versionId } : {}),
      novelId: input.novelId,
      scope,
      ...(scope === "volume"
        ? { targetVolumeId: (input as ReviseVolumeOutlineWorkflowInput).volumeId }
        : {}),
      instruction: input.instruction.trim(),
      revisedOutline: {
        ...policyResult.candidate.revisedOutline,
        status,
      },
      diffSummary: policyResult.candidate.diffSummary,
      impactAnalysis: policyResult.candidate.impactAnalysis,
      chapterNumberChanges: policyResult.candidate.chapterNumberChanges,
      review: reviewResult.output,
      status,
      createdAt,
      agentRuns,
    };
    repository.saveOutlineVersion({
      novelId: input.novelId,
      versionId,
      ...(source.versionId ? { sourceVersionId: source.versionId } : {}),
      status,
      scope,
      ...(scope === "volume"
        ? { targetVolumeId: (input as ReviseVolumeOutlineWorkflowInput).volumeId }
        : {}),
      version,
      createdAt,
    });

    const finishedAt = new Date().toISOString();
    const outputSnapshot = [
      `版本：${versionId}`,
      `状态：${status}`,
      `评分：${reviewResult.output.overallScore}`,
      `编号变化：${version.chapterNumberChanges.length}`,
      "等待用户确认",
    ].join("；");
    const task = repository.saveTask({
      taskId,
      novelId: input.novelId,
      title,
      workflowName,
      status: "waiting_for_user",
      inputSnapshot,
      outputSnapshot,
      startedAt,
      finishedAt,
    });

    return {
      task: {
        ...task,
        workflowName,
        status: "waiting_for_user",
        finishedAt: task.finishedAt ?? finishedAt,
      },
      version,
      agentRuns,
    };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    repository.saveTask({
      taskId,
      novelId: input.novelId,
      title,
      workflowName,
      status: "failed",
      inputSnapshot,
      outputSnapshot: "大纲修改失败，未保存候选版本。",
      error: error instanceof Error ? error.message : String(error),
      startedAt,
      finishedAt,
    });
    throw error;
  }
}

function resolveSourceOutline(
  repository: NovelPreflightRepositoryLike,
  novelId: string,
  sourceVersionId?: string,
) {
  if (sourceVersionId) {
    const stored = repository.getOutlineVersion<OutlineRevisionVersion>(
      novelId,
      sourceVersionId,
    );
    if (!stored) {
      throw new Error(`未找到大纲版本：${sourceVersionId}`);
    }
    return { outline: stored.version.revisedOutline, versionId: stored.versionId };
  }
  const latest = repository.getLatestOutlineVersion<OutlineRevisionVersion>(novelId);
  if (latest) {
    return { outline: latest.version.revisedOutline, versionId: latest.versionId };
  }
  return {
    outline: requireDraft<InitialOutlineDraft>(repository, novelId, "outline"),
    versionId: undefined,
  };
}

function requireDraft<TAsset>(
  repository: NovelPreflightRepositoryLike,
  novelId: string,
  kind: "foundation" | "setting" | "outline",
) {
  const draft = repository.getDraft<TAsset>(novelId, kind);
  if (!draft) {
    throw new Error(`小说缺少${kind}前置资产草案：${novelId}`);
  }
  return draft.asset;
}

function assertInput(
  scope: OutlineRevisionScope,
  input: ReviseMasterOutlineWorkflowInput | ReviseVolumeOutlineWorkflowInput,
) {
  if (!input.novelId.trim()) {
    throw new Error("novelId 不能为空");
  }
  if (!input.instruction.trim()) {
    throw new Error("instruction 不能为空");
  }
  if (
    scope === "volume"
    && !(input as ReviseVolumeOutlineWorkflowInput).volumeId?.trim()
  ) {
    throw new Error("volumeId 不能为空");
  }
}
