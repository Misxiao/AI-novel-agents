import type {
  AgentCapability,
  AgentCapabilityResult,
  ChatCompletionInput,
  ChatCompletionOutput,
} from "../../core/types.js";
import { BaseAgent, type BaseAgentRuntime } from "../../core/baseAgent.js";
import type { ChapterContextReference } from "../chapter/types.js";
import {
  type ChapterReviewIssue,
  type ChapterReviewJsonPayload,
  type ChapterReviewModuleFinding,
  type ChapterReviewOutput,
  type ReviewChapterInput,
} from "./types.js";
import { buildReviewChapterMessages } from "./prompts/reviewChapterPrompt.js";

export type ReviewAgentRuntime = BaseAgentRuntime;

interface CompletionWithTiming {
  completion: ChatCompletionOutput;
  startedAt: string;
  finishedAt: string;
}

const REVIEW_CAPABILITY_ID = "review.reviewChapter";
const DEFAULT_QUALITY_THRESHOLD = 85;

const allowedIssueCategories = new Set<ChapterReviewIssue["category"]>([
  "plot_logic",
  "character_consistency",
  "transition",
  "dialogue",
  "chapter_ending",
  "anti_ai_voice",
  "consistency_review",
  "chapter_plan_coverage",
  "word_count",
]);

const allowedModuleStatuses = new Set(["pass", "warn", "fail"]);

export class ReviewAgent extends BaseAgent {
  readonly id = "review";
  readonly name = "评审 Agent";

  constructor(runtime: ReviewAgentRuntime = {}) {
    super(runtime);
  }

  async reviewChapter(input: ReviewChapterInput): Promise<AgentCapabilityResult<ChapterReviewOutput>> {
    assertReviewInput(input);

    const run = await this.completeWithTiming({
      messages: buildReviewChapterMessages(input),
      temperature: 0.34,
      topP: 0.82,
      maxTokens: 2600,
      responseFormat: "json_object",
    });
    const parsed = parseReviewPayload(run.completion.content);
    const threshold = input.qualityThreshold ?? DEFAULT_QUALITY_THRESHOLD;
    const warnings = normalizeStringArray(parsed.warnings);
    if (!isJsonObject(run.completion.content)) {
      warnings.push("模型响应不是合法 JSON，已使用确定性保底评审。");
    }

    const issues = normalizeIssues(parsed.issues, input);
    issues.push(...buildDeterministicIssues(input));
    const uniqueIssues = dedupeIssues(issues);
    const moduleFindings = normalizeModuleFindings(parsed.moduleFindings, uniqueIssues);
    const score = normalizeScore(parsed.overallScore, uniqueIssues);
    const hasCritical = uniqueIssues.some((issue) => issue.severity === "critical");
    const passed = Boolean(parsed.passed) && score >= threshold && !hasCritical;
    const summary = normalizeOptionalText(parsed.summary) || buildFallbackSummary(input, uniqueIssues);
    const instruction = normalizeOptionalText(parsed.requiredRevisionInstruction)
      || buildRevisionInstruction(uniqueIssues);

    return {
      output: {
        reviewId: `review-${input.draft.draftId}-${this.createSuffix()}`,
        novelId: input.novel.novelId,
        draftId: input.draft.draftId,
        chapterPlanId: input.chapterPlan.id,
        chapterNo: input.chapterPlan.chapterNo,
        passed,
        overallScore: score,
        qualityThreshold: threshold,
        summary,
        strengths: normalizeStringArray(parsed.strengths),
        issues: uniqueIssues,
        moduleFindings,
        requiredRevisionInstruction: instruction,
        warnings: Array.from(new Set(warnings)),
        usedContextRefs: collectUsedContextRefs(input),
        provider: run.completion.provider,
        model: run.completion.model,
        createdAt: run.finishedAt,
      },
      run: buildRunMeta(this.id, REVIEW_CAPABILITY_ID, run),
    };
  }

  private async completeWithTiming(input: ChatCompletionInput): Promise<CompletionWithTiming> {
    const model = await this.getModel();
    const startedAt = this.getNow().toISOString();
    const completion = await model.complete(input);
    const finishedAt = this.getNow().toISOString();

    return { completion, startedAt, finishedAt };
  }

  private createSuffix() {
    return `${this.getNow().getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

export const reviewChapterCapability: AgentCapability<
  ReviewChapterInput,
  ChapterReviewOutput
> = {
  id: REVIEW_CAPABILITY_ID,
  description: "评审章节正文草稿，输出结构化质量报告和修订建议。",
  async run(input, runtime) {
    return new ReviewAgent(runtime).reviewChapter(input);
  },
};

function assertReviewInput(input: ReviewChapterInput) {
  if (!input.novel.novelId.trim()) {
    throw new Error("novelId 不能为空");
  }

  if (input.chapterPlan.novelId !== input.novel.novelId) {
    throw new Error("chapterPlan.novelId 与 novel.novelId 不一致");
  }

  if (input.draft.novelId !== input.novel.novelId) {
    throw new Error("draft.novelId 与 novel.novelId 不一致");
  }

  if (input.draft.chapterPlanId && input.draft.chapterPlanId !== input.chapterPlan.id) {
    throw new Error("draft.chapterPlanId 与 chapterPlan.id 不一致");
  }

  if (!input.draft.content.trim()) {
    throw new Error("draft.content 不能为空");
  }
}

function parseReviewPayload(content: string): ChapterReviewJsonPayload {
  try {
    return JSON.parse(stripCodeFence(content)) as ChapterReviewJsonPayload;
  } catch {
    return {
      passed: false,
      overallScore: 68,
      summary: "模型响应不可解析，已进入保底完稿审查。",
      issues: [
        {
          id: "fallback-review-json",
          severity: "warning",
          category: "consistency_review",
          description: "评审模型未返回合法 JSON，无法信任其自评结果。",
          suggestion: "重新评审或按确定性检查结果修订后复审。",
        },
      ],
      moduleFindings: [
        {
          moduleId: "consistency_review",
          status: "warn",
          finding: "评审响应格式异常。",
        },
      ],
      warnings: ["模型响应不是合法 JSON，已使用确定性保底评审。"],
    };
  }
}

function isJsonObject(content: string) {
  try {
    const parsed = JSON.parse(stripCodeFence(content)) as unknown;
    return Boolean(parsed && typeof parsed === "object" && !Array.isArray(parsed));
  } catch {
    return false;
  }
}

function stripCodeFence(content: string) {
  const trimmed = content.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function normalizeIssues(value: unknown, input: ReviewChapterInput): ChapterReviewIssue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const candidate = item as Partial<ChapterReviewIssue>;
    const category = normalizeIssueCategory(candidate.category);
    const description = normalizeOptionalText(candidate.description);
    if (!description) {
      return [];
    }

    return [{
      id: normalizeOptionalText(candidate.id) || `review-issue-${input.chapterPlan.chapterNo}-${index + 1}`,
      severity: normalizeSeverity(candidate.severity),
      category,
      description,
      suggestion: normalizeOptionalText(candidate.suggestion) || "请按对应专项模块修订后复审。",
    }];
  });
}

function normalizeModuleFindings(
  value: unknown,
  issues: ChapterReviewIssue[],
): ChapterReviewModuleFinding[] {
  const findings: ChapterReviewModuleFinding[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const candidate = item as Partial<ChapterReviewModuleFinding>;
      const moduleId = normalizeIssueCategory(candidate.moduleId);
      const finding = normalizeOptionalText(candidate.finding);
      if (!finding) {
        continue;
      }

      findings.push({
        moduleId,
        status: allowedModuleStatuses.has(String(candidate.status)) ? candidate.status as ChapterReviewModuleFinding["status"] : "warn",
        finding,
      });
    }
  }

  for (const issue of issues) {
    if (!findings.some((finding) => finding.moduleId === issue.category)) {
      findings.push({
        moduleId: issue.category,
        status: issue.severity === "critical" ? "fail" : "warn",
        finding: issue.description,
      });
    }
  }

  return findings;
}

function buildDeterministicIssues(input: ReviewChapterInput): ChapterReviewIssue[] {
  const issues: ChapterReviewIssue[] = [];
  const content = input.draft.content;
  const compact = content.replace(/\s/g, "");
  const wordCount = compact.length;

  for (const expression of input.context?.forbiddenExpressions ?? []) {
    if (expression.trim() && content.includes(expression.trim())) {
      issues.push({
        id: `forbidden-${hashKey(expression)}`,
        severity: "warning",
        category: "anti_ai_voice",
        description: `正文包含禁用表达「${expression.trim()}」。`,
        suggestion: "删除模板化表达，改用具体动作、物件或人物反应承接情绪。",
      });
    }
  }

  if (input.targetWords && input.targetWords > 0) {
    const lower = input.targetWords * 0.65;
    const upper = input.targetWords * 1.45;
    if (wordCount < lower || wordCount > upper) {
      issues.push({
        id: "word-count-drift",
        severity: "warning",
        category: "word_count",
        description: `章节字数 ${wordCount} 与目标 ${input.targetWords} 偏差较大。`,
        suggestion: wordCount < lower
          ? "扩写关键动作、选择、代价、对白压力和章末变化。"
          : "压缩重复说明、空泛情绪和无变化过渡段。",
      });
    }
  }

  if (!hasHookCoverage(content, input.chapterPlan.hook)) {
    issues.push({
      id: "chapter-ending-hook-missing",
      severity: "critical",
      category: "chapter_ending",
      description: "章末没有明显兑现章纲中的追读钩子。",
      suggestion: "把章末落在局面变化、信息反转或下一章第一拍能接住的具体动作上。",
    });
  }

  if (content.split(/\n+/).some((paragraph) => paragraph.replace(/\s/g, "").length > 520)) {
    issues.push({
      id: "paragraph-too-long",
      severity: "warning",
      category: "transition",
      description: "存在超长段落，移动端阅读节奏可能过重。",
      suggestion: "按动作、反应、对白和信息揭示拆段，让场景推进更清楚。",
    });
  }

  return issues;
}

function hasHookCoverage(content: string, hook: string) {
  const compactContent = content.replace(/\s/g, "");
  const hookText = hook
    .replace(/[，。！？、；：“”"'（）()]/g, " ")
    .replace(/\s+/g, "");
  const phraseKeywords = hook
    .replace(/[，。！？、；：“”"'（）()]/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
  const slidingKeywords = Array.from({ length: Math.max(0, hookText.length - 1) }, (_, index) =>
    hookText.slice(index, index + 2),
  ).filter((item) => item.trim().length === 2);
  const keywords = Array.from(new Set([...phraseKeywords, ...slidingKeywords]));
  if (keywords.length === 0) {
    return true;
  }

  const hitCount = keywords.filter((keyword) => compactContent.includes(keyword)).length;
  return hitCount >= 3;
}

function dedupeIssues(issues: ChapterReviewIssue[]) {
  return Array.from(new Map(issues.map((issue) => [issue.id, issue])).values());
}

function normalizeScore(value: unknown, issues: ChapterReviewIssue[]) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 70;
  const bounded = Math.max(0, Math.min(100, Math.round(numeric)));
  if (issues.some((issue) => issue.severity === "critical") && bounded > 84) {
    return bounded;
  }
  return bounded;
}

function normalizeSeverity(value: unknown): ChapterReviewIssue["severity"] {
  return value === "critical" || value === "warning" || value === "info" ? value : "warning";
}

function normalizeIssueCategory(value: unknown): ChapterReviewIssue["category"] {
  return typeof value === "string" && allowedIssueCategories.has(value as ChapterReviewIssue["category"])
    ? value as ChapterReviewIssue["category"]
    : "consistency_review";
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function buildFallbackSummary(input: ReviewChapterInput, issues: ChapterReviewIssue[]) {
  if (issues.length === 0) {
    return `第 ${input.chapterPlan.chapterNo} 章草稿达到基础完稿要求，可进入人工确认。`;
  }

  return `第 ${input.chapterPlan.chapterNo} 章仍有 ${issues.length} 个待处理问题，需修订后复审。`;
}

function buildRevisionInstruction(issues: ChapterReviewIssue[]) {
  if (issues.length === 0) {
    return "";
  }

  return issues
    .filter((issue) => issue.severity !== "info")
    .map((issue) => `${issue.category}：${issue.description}；建议：${issue.suggestion}`)
    .join("\n");
}

function collectUsedContextRefs(input: ReviewChapterInput): ChapterContextReference[] {
  const refs: ChapterContextReference[] = [...(input.context?.contextRefs ?? [])];
  if (input.context?.canonFacts?.length) {
    refs.push({ id: "context:canon", type: "canon", title: "Canon 事实" });
  }
  if (input.context?.forbiddenExpressions?.length || input.context?.styleGuidance?.length) {
    refs.push({ id: "context:style", type: "style", title: "风格约束" });
  }

  return Array.from(new Map(refs.map((ref) => [ref.id, ref])).values());
}

function hashKey(value: string) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36);
}

function buildRunMeta(agentId: string, capabilityId: string, run: CompletionWithTiming) {
  return {
    agentId,
    capabilityId,
    provider: run.completion.provider,
    model: run.completion.model,
    usage: run.completion.usage,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  };
}
