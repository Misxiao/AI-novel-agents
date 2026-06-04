import type {
  AgentCapability,
  AgentCapabilityResult,
  ChatCompletionInput,
  ChatMessage,
  ChatCompletionOutput,
} from "../../core/types.js";
import { BaseAgent, type BaseAgentRuntime } from "../../core/baseAgent.js";
import { buildChapterModuleChain } from "../../webnovelSkill/runtime.js";
import {
  type ChapterContextPackage,
  type ChapterContextReference,
  type ChapterDraftJsonPayload,
  type ChapterDraftPlanJsonPayload,
  type ChapterSceneBeat,
  type ChapterTextOperationJsonPayload,
  type ChapterTextOperationOutput,
  type CompressTextInput,
  type ExpandTextInput,
  type PlanChapterDraftInput,
  type PlanChapterDraftOutput,
  type PolishStyleInput,
  type RewriteSceneInput,
  type ReviseChapterInput,
  type WriteNextChapterInput,
  type WriteNextChapterOutput,
} from "./types.js";
import {
  buildCompressTextMessages,
  buildExpandTextMessages,
  buildPlanChapterDraftMessages,
  buildPolishStyleMessages,
  buildRewriteSceneMessages,
  buildReviseChapterMessages,
  buildWriteNextChapterMessages,
} from "./prompts/writeNextChapterPrompt.js";

export type ChapterAgentRuntime = BaseAgentRuntime;

type TextOperationKind =
  | "chapter.reviseChapter"
  | "chapter.rewriteScene"
  | "chapter.expandText"
  | "chapter.compressText"
  | "chapter.polishStyle";

interface CompletionWithTiming {
  completion: ChatCompletionOutput;
  startedAt: string;
  finishedAt: string;
}

export class ChapterAgent extends BaseAgent {
  readonly id = "chapter";
  readonly name = "章节 Agent";

  constructor(runtime: ChapterAgentRuntime = {}) {
    super(runtime);
  }

  async planChapterDraft(
    input: PlanChapterDraftInput,
  ): Promise<AgentCapabilityResult<PlanChapterDraftOutput>> {
    assertChapterTaskInput(input);

    const run = await this.completeWithTiming({
      messages: buildPlanChapterDraftMessages(input),
      temperature: 0.48,
      topP: 0.85,
      maxTokens: 2200,
      responseFormat: "json_object",
    });
    const parsed = parseJsonPayload<ChapterDraftPlanJsonPayload>(run.completion.content, {
      warnings: ["模型响应不是合法 JSON，已使用章纲生成保底写作计划。"],
    });
    const warnings = normalizeStringArray(parsed.warnings);

    return {
      output: {
        planId: `chapter-plan-${input.chapterPlan.id}-${this.createSuffix()}`,
        novelId: input.novel.novelId,
        chapterPlanId: input.chapterPlan.id,
        chapterNo: input.chapterPlan.chapterNo,
        viewpoint: normalizeOptionalText(parsed.viewpoint) || "主角强相关视角",
        objective: normalizeOptionalText(parsed.objective) || input.chapterPlan.objective,
        obstacle: normalizeOptionalText(parsed.obstacle) || "围绕当前章纲目标设置直接阻碍",
        change: normalizeOptionalText(parsed.change) || "章末局面必须相对开头发生变化",
        sceneBeats: normalizeSceneBeats(parsed.sceneBeats),
        rewardMoment: normalizeOptionalText(parsed.rewardMoment) || "兑现一个发现、反击、关系变化或小反转",
        endingHook: normalizeOptionalText(parsed.endingHook) || input.chapterPlan.hook,
        riskNotes: normalizeStringArray(parsed.riskNotes),
        warnings,
        usedContextRefs: collectUsedContextRefs(input.context),
        moduleChain: buildChapterModuleChain(true),
        provider: run.completion.provider,
        model: run.completion.model,
        createdAt: run.finishedAt,
      },
      run: buildRunMeta(this.id, "chapter.planChapterDraft", run),
    };
  }

  async writeNextChapter(
    input: WriteNextChapterInput,
  ): Promise<AgentCapabilityResult<WriteNextChapterOutput>> {
    assertChapterTaskInput(input);

    const run = await this.completeWithTiming({
      messages: buildWriteNextChapterMessages(input),
      temperature: 0.78,
      topP: 0.9,
      maxTokens: 5200,
      responseFormat: "json_object",
    });
    const parsed = parseChapterDraftPayload(run.completion.content);
    const content = normalizeRequiredText(parsed.content, "content");
    const title = normalizeOptionalText(parsed.title) || input.chapterPlan.title;
    const summary = normalizeOptionalText(parsed.summary) || buildFallbackSummary(input, content);
    const warnings = buildDeterministicWarnings({
      content,
      title,
      targetWords: input.targetWords,
      modelWarnings: normalizeStringArray(parsed.warnings),
    });

    return {
      output: {
        draftId: `draft-${input.chapterPlan.id}-${this.createSuffix()}`,
        novelId: input.novel.novelId,
        chapterPlanId: input.chapterPlan.id,
        chapterNo: input.chapterPlan.chapterNo,
        title,
        content,
        summary,
        wordCount: countChineseBodyChars(content),
        status: "draft",
        warnings,
        usedContextRefs: collectUsedContextRefs(input.context),
        moduleChain: buildChapterModuleChain(true),
        provider: run.completion.provider,
        model: run.completion.model,
        createdAt: run.finishedAt,
      },
      run: buildRunMeta(this.id, "chapter.writeNextChapter", run),
    };
  }

  async reviseChapter(
    input: ReviseChapterInput,
  ): Promise<AgentCapabilityResult<ChapterTextOperationOutput>> {
    return this.runTextOperation("chapter.reviseChapter", input, buildReviseChapterMessages(input));
  }

  async rewriteScene(
    input: RewriteSceneInput,
  ): Promise<AgentCapabilityResult<ChapterTextOperationOutput>> {
    if (!input.scene.originalText.trim()) {
      throw new Error("重写场景原文不能为空");
    }

    return this.runTextOperation("chapter.rewriteScene", input, buildRewriteSceneMessages(input));
  }

  async expandText(
    input: ExpandTextInput,
  ): Promise<AgentCapabilityResult<ChapterTextOperationOutput>> {
    assertPositiveTargetWords(input.targetWords);
    return this.runTextOperation("chapter.expandText", input, buildExpandTextMessages(input));
  }

  async compressText(
    input: CompressTextInput,
  ): Promise<AgentCapabilityResult<ChapterTextOperationOutput>> {
    assertPositiveTargetWords(input.targetWords);
    return this.runTextOperation("chapter.compressText", input, buildCompressTextMessages(input));
  }

  async polishStyle(
    input: PolishStyleInput,
  ): Promise<AgentCapabilityResult<ChapterTextOperationOutput>> {
    return this.runTextOperation("chapter.polishStyle", input, buildPolishStyleMessages(input));
  }

  private async runTextOperation(
    capabilityId: TextOperationKind,
    input: ReviseChapterInput,
    messages: ChatMessage[],
  ): Promise<AgentCapabilityResult<ChapterTextOperationOutput>> {
    assertRevisionInput(input);

    const run = await this.completeWithTiming({
      messages,
      temperature: capabilityId === "chapter.polishStyle" ? 0.56 : 0.62,
      topP: 0.88,
      maxTokens: 5600,
      responseFormat: "json_object",
    });
    const parsed = parseTextOperationPayload(run.completion.content);
    const content = normalizeRequiredText(parsed.content, "content");
    const title = normalizeOptionalText(parsed.title) || input.draft.title || input.chapterPlan.title;
    const summary = normalizeOptionalText(parsed.summary) || buildFallbackSummary(input, content);
    const warnings = buildDeterministicWarnings({
      content,
      title,
      targetWords: input.targetWords,
      modelWarnings: normalizeStringArray(parsed.warnings),
    });

    return {
      output: {
        draftId: `draft-${input.chapterPlan.id}-${capabilityId.split(".")[1]}-${this.createSuffix()}`,
        sourceDraftId: input.draft.draftId,
        novelId: input.novel.novelId,
        chapterPlanId: input.chapterPlan.id,
        chapterNo: input.chapterPlan.chapterNo,
        title,
        content,
        summary,
        wordCount: countChineseBodyChars(content),
        status: "draft",
        changedSummary: normalizeOptionalText(parsed.changedSummary) || "已根据 chapter Agent 能力生成待确认修改稿。",
        handledIssueIds: normalizeStringArray(parsed.handledIssueIds),
        unresolvedRisks: normalizeStringArray(parsed.unresolvedRisks),
        warnings,
        usedContextRefs: collectUsedContextRefs(input.context),
        moduleChain: buildChapterModuleChain(true),
        provider: run.completion.provider,
        model: run.completion.model,
        createdAt: run.finishedAt,
      },
      run: buildRunMeta(this.id, capabilityId, run),
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

export const planChapterDraftCapability: AgentCapability<
  PlanChapterDraftInput,
  PlanChapterDraftOutput
> = {
  id: "chapter.planChapterDraft",
  description: "根据当前章纲和上下文包生成章节写作前执行计划。",
  async run(input, runtime) {
    return new ChapterAgent(runtime).planChapterDraft(input);
  },
};

export const writeNextChapterCapability: AgentCapability<
  WriteNextChapterInput,
  WriteNextChapterOutput
> = {
  id: "chapter.writeNextChapter",
  description: "根据当前小说章纲和上下文包生成下一章正文草稿。",
  async run(input, runtime) {
    return new ChapterAgent(runtime).writeNextChapter(input);
  },
};

export const reviseChapterCapability: AgentCapability<
  ReviseChapterInput,
  ChapterTextOperationOutput
> = {
  id: "chapter.reviseChapter",
  description: "根据用户要求或评审问题修订整章正文草稿。",
  async run(input, runtime) {
    return new ChapterAgent(runtime).reviseChapter(input);
  },
};

export const rewriteSceneCapability: AgentCapability<
  RewriteSceneInput,
  ChapterTextOperationOutput
> = {
  id: "chapter.rewriteScene",
  description: "重写指定场景并返回完整章节正文草稿。",
  async run(input, runtime) {
    return new ChapterAgent(runtime).rewriteScene(input);
  },
};

export const expandTextCapability: AgentCapability<
  ExpandTextInput,
  ChapterTextOperationOutput
> = {
  id: "chapter.expandText",
  description: "在保持剧情事实稳定的前提下扩写章节正文。",
  async run(input, runtime) {
    return new ChapterAgent(runtime).expandText(input);
  },
};

export const compressTextCapability: AgentCapability<
  CompressTextInput,
  ChapterTextOperationOutput
> = {
  id: "chapter.compressText",
  description: "在保持关键事实稳定的前提下压缩章节正文。",
  async run(input, runtime) {
    return new ChapterAgent(runtime).compressText(input);
  },
};

export const polishStyleCapability: AgentCapability<
  PolishStyleInput,
  ChapterTextOperationOutput
> = {
  id: "chapter.polishStyle",
  description: "对章节正文进行风格处理和去 AI 味润色。",
  async run(input, runtime) {
    return new ChapterAgent(runtime).polishStyle(input);
  },
};

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

function assertChapterTaskInput(input: Pick<WriteNextChapterInput, "novel" | "chapterPlan">) {
  if (!input.novel.novelId.trim()) {
    throw new Error("novelId 不能为空");
  }

  if (input.chapterPlan.novelId !== input.novel.novelId) {
    throw new Error("chapterPlan.novelId 与 novel.novelId 不一致");
  }

  if (!input.chapterPlan.objective.trim()) {
    throw new Error("章节目标不能为空");
  }
}

function assertRevisionInput(input: ReviseChapterInput) {
  assertChapterTaskInput(input);

  if (input.draft.novelId !== input.novel.novelId) {
    throw new Error("draft.novelId 与 novel.novelId 不一致");
  }

  if (input.draft.chapterPlanId && input.draft.chapterPlanId !== input.chapterPlan.id) {
    throw new Error("draft.chapterPlanId 与 chapterPlan.id 不一致");
  }

  normalizeRequiredText(input.draft.content, "draft.content");
}

function assertPositiveTargetWords(targetWords?: number) {
  if (!Number.isFinite(targetWords) || (targetWords ?? 0) <= 0) {
    throw new Error("targetWords 必须为正数");
  }
}

function parseChapterDraftPayload(content: string): ChapterDraftJsonPayload {
  return parseJsonPayload<ChapterDraftJsonPayload>(content, {
    content,
    summary: "模型返回了非 JSON 内容，已按正文文本保存。",
    warnings: ["模型响应不是合法 JSON，后续需要评审 Agent 复查结构。"],
  });
}

function parseTextOperationPayload(content: string): ChapterTextOperationJsonPayload {
  return parseJsonPayload<ChapterTextOperationJsonPayload>(content, {
    content,
    summary: "模型返回了非 JSON 内容，已按完整正文保存。",
    changedSummary: "模型响应不是合法 JSON，已将响应作为正文候选稿保存。",
    warnings: ["模型响应不是合法 JSON，后续需要评审 Agent 复查结构。"],
  });
}

function parseJsonPayload<TPayload extends object>(content: string, fallback: TPayload): TPayload {
  try {
    return JSON.parse(stripCodeFence(content)) as TPayload;
  } catch {
    return fallback;
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

function normalizeRequiredText(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`章节草稿缺少 ${fieldName}`);
  }

  return value.trim();
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function normalizeSceneBeats(value: unknown): ChapterSceneBeat[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const candidate = item as Partial<ChapterSceneBeat>;
    const purpose = normalizeOptionalText(candidate.purpose);
    const conflict = normalizeOptionalText(candidate.conflict);
    const change = normalizeOptionalText(candidate.change);
    if (!purpose || !conflict || !change) {
      return [];
    }

    return [{
      sceneNo: Number.isFinite(candidate.sceneNo) ? Number(candidate.sceneNo) : index + 1,
      purpose,
      conflict,
      change,
      keyCharacters: normalizeStringArray(candidate.keyCharacters),
    }];
  });
}

function buildFallbackSummary(input: Pick<WriteNextChapterInput, "chapterPlan">, content: string) {
  const excerpt = content.replace(/\s+/g, "").slice(0, 80);
  return `第 ${input.chapterPlan.chapterNo} 章围绕「${input.chapterPlan.objective}」展开。${excerpt}`;
}

function countChineseBodyChars(content: string) {
  return content.replace(/\s/g, "").length;
}

function buildDeterministicWarnings(params: {
  content: string;
  title: string;
  targetWords?: number;
  modelWarnings: string[];
}) {
  const warnings = [...params.modelWarnings];
  const compact = params.content.replace(/\s+/g, "");
  const wordCount = countChineseBodyChars(params.content);

  if (params.title && compact.startsWith(params.title.replace(/\s+/g, ""))) {
    warnings.push("章节正文疑似包含标题行，入库前建议移除标题。");
  }

  if (params.targetWords && params.targetWords > 0) {
    const lower = params.targetWords * 0.65;
    const upper = params.targetWords * 1.45;
    if (wordCount < lower || wordCount > upper) {
      warnings.push(`章节字数 ${wordCount} 与目标 ${params.targetWords} 偏差较大。`);
    }
  }

  const paragraphs = params.content.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  if (paragraphs.some((paragraph) => paragraph.replace(/\s/g, "").length > 520)) {
    warnings.push("存在超长段落，移动端阅读可能压迫感过强。");
  }

  const templateSignals = ["他知道，这只是开始", "命运的齿轮", "空气仿佛凝固", "一切都还没有结束"];
  if (templateSignals.some((signal) => params.content.includes(signal))) {
    warnings.push("正文包含常见模板化表达，建议后续去 AI 味复查。");
  }

  if (!params.content.trim()) {
    warnings.push("章节正文为空。");
  }

  return Array.from(new Set(warnings));
}

function collectUsedContextRefs(context?: ChapterContextPackage): ChapterContextReference[] {
  const refs: ChapterContextReference[] = [...(context?.contextRefs ?? [])];

  addContextRef(refs, Boolean(context?.outlineSummary?.trim()), "context:outline", "outline", "总纲摘要");
  addContextRef(refs, Boolean(context?.volumeGoal?.trim()), "context:volume", "volume", "分卷目标");
  addContextRef(refs, Boolean(context?.previousChapterSummary?.trim()), "context:previous-chapter", "chapter", "上一章摘要");
  addContextRef(refs, Boolean(context?.nextChapterObjective?.trim()), "context:next-chapter", "chapter", "下一章目标");
  addContextRef(refs, Boolean(context?.styleGuidance?.length), "context:style", "style", "风格约束");
  addContextRef(refs, Boolean(context?.worldRules?.length), "context:world-rules", "world_rule", "世界观硬规则");
  addContextRef(refs, Boolean(context?.canonFacts?.length), "context:canon", "canon", "Canon 事实");
  addContextRef(refs, Boolean(context?.ragSnippets?.length), "context:rag", "rag", "检索片段");

  for (const character of context?.characterStates ?? []) {
    addContextRef(refs, true, `character:${character.id}`, "character", character.name);
  }

  for (const item of context?.foreshadowing ?? []) {
    addContextRef(refs, true, `foreshadowing:${item.id}`, "foreshadowing", item.title);
  }

  return Array.from(new Map(refs.map((ref) => [ref.id, ref])).values());
}

function addContextRef(
  refs: ChapterContextReference[],
  shouldAdd: boolean,
  id: string,
  type: ChapterContextReference["type"],
  title: string,
) {
  if (shouldAdd) {
    refs.push({ id, type, title });
  }
}
