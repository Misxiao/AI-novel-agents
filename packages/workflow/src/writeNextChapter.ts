import {
  ChapterAgent,
  PlanAgent,
  ReviewAgent,
  type ChapterReviewIssueInput,
  type ChapterReviewOutput,
  type ChapterTextOperationOutput,
  type ChapterPlanInput,
  type ChatModel,
  type CreateChapterDraftPlanOutput,
  type CreateChapterPlanOutput,
  type TokenUsage,
  type WriteNextChapterOutput,
} from "../../agents/src/index.js";
import {
  ChapterProductionRepository,
  type ChapterProductionAssets,
  type ChapterProductionRepositoryLike,
} from "../../repositories/src/index.js";

export type ChapterPlanPolicy = "use_existing_or_generate" | "require_existing";

export interface WriteNextChapterWorkflowInput {
  model?: ChatModel;
  novelId: string;
  chapterNo?: number;
  authorIntent?: string;
  targetWords?: number;
  repository?: ChapterProductionRepositoryLike;
  planPolicy?: ChapterPlanPolicy;
  maxRevisionRounds?: number;
  qualityThreshold?: number;
}

export interface WriteNextChapterWorkflowResult {
  task: {
    taskId: string;
    novelId: string;
    title: string;
    workflowName: "write-next-chapter";
    status: "succeeded";
    inputSnapshot: string;
    outputSnapshot: string;
    startedAt: string;
    finishedAt: string;
  };
  chapterPlan: ChapterPlanInput;
  generatedChapterPlan?: CreateChapterPlanOutput;
  draftPlan: CreateChapterDraftPlanOutput;
  initialDraft: WriteNextChapterOutput;
  finalDraft: WriteNextChapterOutput;
  draft: WriteNextChapterOutput;
  reviewReports: ChapterReviewOutput[];
  revisionHistory: Array<{
    round: number;
    sourceDraftId: string;
    revisedDraftId: string;
    beforeScore: number;
    afterScore: number;
    changedSummary: string;
    handledIssueIds: string[];
    unresolvedRisks: string[];
  }>;
  qualityGate: {
    passed: boolean;
    score: number;
    threshold: number;
    revisionRounds: number;
    unresolvedCriticalIssues: string[];
    selectedDraftId: string;
  };
  contextRefs: ChapterProductionAssets["sourceRefs"];
  missingAssets: string[];
  agentRuns: Array<{
    agentId: string;
    capabilityId: string;
    provider: string;
    model: string;
    usage?: TokenUsage;
    startedAt: string;
    finishedAt: string;
  }>;
  agentRun: {
    agentId: "chapter";
    capabilityId: "chapter.writeNextChapter" | "chapter.reviseChapter";
    provider: string;
    model: string;
    usage?: TokenUsage;
    startedAt: string;
    finishedAt: string;
  };
}

export async function runWriteNextChapterWorkflow(
  input: WriteNextChapterWorkflowInput,
): Promise<WriteNextChapterWorkflowResult> {
  const startedAt = new Date().toISOString();
  const repository = input.repository ?? new ChapterProductionRepository();
  const planPolicy = input.planPolicy ?? "use_existing_or_generate";
  const assets = repository.assembleChapterProductionContext({
    novelId: input.novelId,
    chapterNo: input.chapterNo,
    authorIntent: input.authorIntent,
  });

  const planAgent = new PlanAgent({ model: input.model });
  const chapterAgent = new ChapterAgent({ model: input.model });
  const reviewAgent = new ReviewAgent({ model: input.model });
  const agentRuns: WriteNextChapterWorkflowResult["agentRuns"] = [];

  let generatedChapterPlan: CreateChapterPlanOutput | undefined;
  let chapterPlan: ChapterPlanInput | undefined = assets.chapterPlan;

  if (!chapterPlan) {
    if (planPolicy === "require_existing") {
      throw new Error(`第 ${assets.chapterNo} 章缺少章纲，且 planPolicy=require_existing。`);
    }

    const chapterPlanResult = await planAgent.createChapterPlan({
      novel: assets.novel,
      chapterNo: assets.chapterNo,
      context: assets.context,
      authorIntent: input.authorIntent,
    });
    generatedChapterPlan = chapterPlanResult.output;
    chapterPlan = generatedChapterPlan;
    agentRuns.push(chapterPlanResult.run);
  }

  const draftPlanResult = await planAgent.createChapterDraftPlan({
    novel: assets.novel,
    chapterPlan,
    context: assets.context,
    authorIntent: input.authorIntent,
    targetWords: input.targetWords,
  });
  agentRuns.push(draftPlanResult.run);

  const draftResult = await chapterAgent.writeNextChapter({
    novel: assets.novel,
    chapterPlan,
    context: assets.context,
    draftPlan: draftPlanResult.output,
    targetWords: input.targetWords,
  });
  agentRuns.push(draftResult.run);

  const qualityThreshold = normalizeQualityThreshold(input.qualityThreshold);
  const maxRevisionRounds = normalizeMaxRevisionRounds(input.maxRevisionRounds);
  const reviewReports: ChapterReviewOutput[] = [];
  const revisionHistory: WriteNextChapterWorkflowResult["revisionHistory"] = [];
  let currentDraft: WriteNextChapterOutput = draftResult.output;
  let currentReviewResult = await reviewAgent.reviewChapter({
    novel: assets.novel,
    chapterPlan,
    context: assets.context,
    draftPlan: draftPlanResult.output,
    draft: currentDraft,
    targetWords: input.targetWords,
    qualityThreshold,
  });
  agentRuns.push(currentReviewResult.run);
  reviewReports.push(currentReviewResult.output);

  let bestDraft: WriteNextChapterOutput = currentDraft;
  let bestReview: ChapterReviewOutput = currentReviewResult.output;
  let lastChapterRun = draftResult.run;

  for (let round = 1; round <= maxRevisionRounds && !isReviewPassed(currentReviewResult.output); round += 1) {
    const beforeScore = currentReviewResult.output.overallScore;
    const revisionResult = await chapterAgent.reviseChapter({
      novel: assets.novel,
      chapterPlan,
      context: assets.context,
      draft: currentDraft,
      instruction: buildRevisionInstruction(currentReviewResult.output),
      reviewIssues: toChapterReviewIssueInputs(currentReviewResult.output),
      targetWords: input.targetWords,
    });
    agentRuns.push(revisionResult.run);
    lastChapterRun = revisionResult.run;

    const revisedDraft = toWriteNextChapterOutput(revisionResult.output);
    const nextReviewResult = await reviewAgent.reviewChapter({
      novel: assets.novel,
      chapterPlan,
      context: assets.context,
      draftPlan: draftPlanResult.output,
      draft: revisedDraft,
      targetWords: input.targetWords,
      qualityThreshold,
    });
    agentRuns.push(nextReviewResult.run);
    reviewReports.push(nextReviewResult.output);

    revisionHistory.push({
      round,
      sourceDraftId: currentDraft.draftId,
      revisedDraftId: revisedDraft.draftId,
      beforeScore,
      afterScore: nextReviewResult.output.overallScore,
      changedSummary: revisionResult.output.changedSummary,
      handledIssueIds: revisionResult.output.handledIssueIds,
      unresolvedRisks: revisionResult.output.unresolvedRisks,
    });

    if (isBetterReview(nextReviewResult.output, bestReview)) {
      bestDraft = revisedDraft;
      bestReview = nextReviewResult.output;
    }

    currentDraft = revisedDraft;
    currentReviewResult = nextReviewResult;

    if (isReviewPassed(nextReviewResult.output) || nextReviewResult.output.overallScore <= beforeScore) {
      break;
    }
  }

  const finishedAt = new Date().toISOString();
  const chapterRun = {
    agentId: "chapter" as const,
    capabilityId: lastChapterRun.capabilityId as "chapter.writeNextChapter" | "chapter.reviseChapter",
    provider: lastChapterRun.provider,
    model: lastChapterRun.model,
    usage: lastChapterRun.usage,
    startedAt: lastChapterRun.startedAt,
    finishedAt: lastChapterRun.finishedAt,
  };

  return {
    task: {
      taskId: `task-write-next-chapter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      novelId: input.novelId,
      title: `写下一章：第 ${chapterPlan.chapterNo} 章`,
      workflowName: "write-next-chapter",
      status: "succeeded",
      inputSnapshot: buildInputSnapshot(input, chapterPlan),
      outputSnapshot: buildOutputSnapshot(chapterPlan, bestDraft, bestReview, revisionHistory.length),
      startedAt,
      finishedAt,
    },
    chapterPlan,
    generatedChapterPlan,
    draftPlan: draftPlanResult.output,
    initialDraft: draftResult.output,
    finalDraft: bestDraft,
    draft: bestDraft,
    reviewReports,
    revisionHistory,
    qualityGate: {
      passed: isReviewPassed(bestReview),
      score: bestReview.overallScore,
      threshold: qualityThreshold,
      revisionRounds: revisionHistory.length,
      unresolvedCriticalIssues: bestReview.issues
        .filter((issue) => issue.severity === "critical")
        .map((issue) => issue.id),
      selectedDraftId: bestDraft.draftId,
    },
    contextRefs: assets.sourceRefs,
    missingAssets: assets.missingAssets,
    agentRuns,
    agentRun: chapterRun,
  };
}

function buildInputSnapshot(input: WriteNextChapterWorkflowInput, chapterPlan: ChapterPlanInput) {
  const intent = input.authorIntent?.trim();
  const suffix = intent ? `；作者想法：${intent}` : "";
  return `writeNextChapter：第 ${chapterPlan.chapterNo} 章《${chapterPlan.title}》${suffix}`;
}

function buildOutputSnapshot(
  chapterPlan: ChapterPlanInput,
  draft: WriteNextChapterOutput,
  review: ChapterReviewOutput,
  revisionRounds: number,
) {
  const status = review.passed ? "通过质量门禁" : "仍需人工复核";
  const revisionText = revisionRounds > 0 ? `，自动修订 ${revisionRounds} 轮` : "";
  return `已生成第 ${chapterPlan.chapterNo} 章正文草稿，约 ${draft.wordCount} 字，评审 ${review.overallScore} 分，${status}${revisionText}。`;
}

function normalizeQualityThreshold(value?: number) {
  if (!Number.isFinite(value)) {
    return 85;
  }

  return Math.max(0, Math.min(100, Math.round(value ?? 85)));
}

function normalizeMaxRevisionRounds(value?: number) {
  if (!Number.isFinite(value)) {
    return 2;
  }

  return Math.max(0, Math.min(5, Math.floor(value ?? 2)));
}

function isReviewPassed(review: ChapterReviewOutput) {
  return review.passed
    && review.overallScore >= review.qualityThreshold
    && !review.issues.some((issue) => issue.severity === "critical");
}

function isBetterReview(next: ChapterReviewOutput, current: ChapterReviewOutput) {
  if (isReviewPassed(next) && !isReviewPassed(current)) {
    return true;
  }

  return next.overallScore > current.overallScore;
}

function buildRevisionInstruction(review: ChapterReviewOutput) {
  if (review.requiredRevisionInstruction.trim()) {
    return review.requiredRevisionInstruction;
  }

  return review.issues
    .filter((issue) => issue.severity !== "info")
    .map((issue) => `${issue.category}：${issue.description}；建议：${issue.suggestion}`)
    .join("\n");
}

function toChapterReviewIssueInputs(review: ChapterReviewOutput): ChapterReviewIssueInput[] {
  return review.issues.map((issue) => ({
    id: issue.id,
    severity: issue.severity,
    category: issue.category,
    description: issue.description,
    suggestion: issue.suggestion,
  }));
}

function toWriteNextChapterOutput(output: ChapterTextOperationOutput): WriteNextChapterOutput {
  return {
    draftId: output.draftId,
    novelId: output.novelId,
    chapterPlanId: output.chapterPlanId,
    chapterNo: output.chapterNo,
    title: output.title,
    content: output.content,
    summary: output.summary,
    wordCount: output.wordCount,
    status: output.status,
    warnings: output.warnings,
    usedContextRefs: output.usedContextRefs,
    moduleChain: output.moduleChain,
    provider: output.provider,
    model: output.model,
    createdAt: output.createdAt,
  };
}
