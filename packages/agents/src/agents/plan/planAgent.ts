import type {
  AgentCapability,
  AgentCapabilityResult,
  ChatCompletionInput,
  ChatCompletionOutput,
} from "../../core/types.js";
import { BaseAgent, type BaseAgentRuntime } from "../../core/baseAgent.js";
import { buildChapterModuleChain } from "../../webnovelSkill/runtime.js";
import type { ChapterContextPackage, ChapterContextReference, ChapterPlanInput, ChapterSceneBeat } from "../chapter/types.js";
import {
  type CreateChapterDraftPlanInput,
  type CreateChapterDraftPlanOutput,
  type CreateChapterPlanInput,
  type CreateChapterPlanOutput,
  type PlanAgentChapterPlanJsonPayload,
  type PlanAgentDraftPlanJsonPayload,
} from "./types.js";
import {
  buildCreateChapterDraftPlanMessages,
  buildCreateChapterPlanMessages,
} from "./prompts/planPrompts.js";

export type PlanAgentRuntime = BaseAgentRuntime;

interface CompletionWithTiming {
  completion: ChatCompletionOutput;
  startedAt: string;
  finishedAt: string;
}

export class PlanAgent extends BaseAgent {
  readonly id = "plan";
  readonly name = "章节规划 Agent";

  constructor(runtime: PlanAgentRuntime = {}) {
    super(runtime);
  }

  async createChapterPlan(
    input: CreateChapterPlanInput,
  ): Promise<AgentCapabilityResult<CreateChapterPlanOutput>> {
    assertPlanInput(input);

    const run = await this.completeWithTiming({
      messages: buildCreateChapterPlanMessages(input),
      temperature: 0.46,
      topP: 0.86,
      maxTokens: 1800,
      responseFormat: "json_object",
    });
    const parsed = parseJsonPayload<PlanAgentChapterPlanJsonPayload>(run.completion.content);
    const title = normalizeOptionalText(parsed.title) || `第 ${input.chapterNo} 章`;
    const objective = normalizeRequiredText(parsed.objective, "objective");
    const hook = normalizeRequiredText(parsed.hook, "hook");

    return {
      output: {
        id: `chapter-plan-${input.novel.novelId}-${input.chapterNo}-${this.createSuffix()}`,
        novelId: input.novel.novelId,
        chapterNo: input.chapterNo,
        title,
        volumeTitle: normalizeOptionalText(parsed.volumeTitle) || input.novel.currentVolume,
        objective,
        hook,
        status: normalizeOptionalText(parsed.status) || "草稿",
        warnings: normalizeStringArray(parsed.warnings),
        usedContextRefs: collectUsedContextRefs(input.context),
        moduleChain: buildChapterModuleChain(true),
        provider: run.completion.provider,
        model: run.completion.model,
        createdAt: run.finishedAt,
      },
      run: buildRunMeta(this.id, "plan.createChapterPlan", run),
    };
  }

  async createChapterDraftPlan(
    input: CreateChapterDraftPlanInput,
  ): Promise<AgentCapabilityResult<CreateChapterDraftPlanOutput>> {
    assertDraftPlanInput(input);

    const run = await this.completeWithTiming({
      messages: buildCreateChapterDraftPlanMessages(input),
      temperature: 0.48,
      topP: 0.85,
      maxTokens: 2200,
      responseFormat: "json_object",
    });
    const parsed = parseJsonPayload<PlanAgentDraftPlanJsonPayload>(run.completion.content);

    return {
      output: {
        planId: `draft-plan-${input.chapterPlan.id}-${this.createSuffix()}`,
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
        warnings: normalizeStringArray(parsed.warnings),
        usedContextRefs: collectUsedContextRefs(input.context),
        moduleChain: buildChapterModuleChain(true),
        provider: run.completion.provider,
        model: run.completion.model,
        createdAt: run.finishedAt,
      },
      run: buildRunMeta(this.id, "plan.createChapterDraftPlan", run),
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

export const createChapterPlanCapability: AgentCapability<
  CreateChapterPlanInput,
  CreateChapterPlanOutput
> = {
  id: "plan.createChapterPlan",
  description: "根据小说资产和作者想法生成单章章纲草案。",
  async run(input, runtime) {
    return new PlanAgent(runtime).createChapterPlan(input);
  },
};

export const createChapterDraftPlanCapability: AgentCapability<
  CreateChapterDraftPlanInput,
  CreateChapterDraftPlanOutput
> = {
  id: "plan.createChapterDraftPlan",
  description: "根据章纲和上下文生成章节写作执行计划。",
  async run(input, runtime) {
    return new PlanAgent(runtime).createChapterDraftPlan(input);
  },
};

function assertPlanInput(input: CreateChapterPlanInput) {
  if (!input.novel.novelId.trim()) {
    throw new Error("novelId 不能为空");
  }
  if (!Number.isFinite(input.chapterNo) || input.chapterNo <= 0) {
    throw new Error("chapterNo 必须为正数");
  }
}

function assertDraftPlanInput(input: CreateChapterDraftPlanInput) {
  assertPlanInput({ novel: input.novel, chapterNo: input.chapterPlan.chapterNo, context: input.context, authorIntent: input.authorIntent });
  if (input.chapterPlan.novelId !== input.novel.novelId) {
    throw new Error("chapterPlan.novelId 与 novel.novelId 不一致");
  }
  if (!input.chapterPlan.objective.trim()) {
    throw new Error("章节目标不能为空");
  }
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

function parseJsonPayload<TPayload extends object>(content: string): TPayload {
  try {
    return JSON.parse(stripCodeFence(content)) as TPayload;
  } catch {
    throw new Error("PlanAgent 模型响应不是合法 JSON");
  }
}

function stripCodeFence(content: string) {
  const trimmed = content.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function normalizeRequiredText(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`章节规划缺少 ${fieldName}`);
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

function collectUsedContextRefs(context?: ChapterContextPackage): ChapterContextReference[] {
  return Array.from(new Map((context?.contextRefs ?? []).map((ref) => [ref.id, ref])).values());
}
