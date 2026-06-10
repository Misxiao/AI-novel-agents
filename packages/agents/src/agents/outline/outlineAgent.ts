import type { AgentCapability, AgentCapabilityResult, ChatCompletionInput } from "../../core/types.js";
import { BaseAgent, type BaseAgentRuntime } from "../../core/baseAgent.js";
import type {
  ChapterNumberChange,
  ForeshadowingDraft,
  InitialOutlineDraft,
  OutlineIssueDraft,
  OutlineRevisionCandidate,
  OutlineRevisionConflict,
  OutlineStructureIdMapping,
  ReviseMasterOutlineInput,
  ReviseVolumeOutlineInput,
  TimelineEventDraft,
  VolumePlanDraft,
} from "../preflight/types.js";
import {
  buildRunMeta,
  optionalText,
  parseJsonPayload,
  requiredText,
  stringArray,
  type CompletionWithTiming,
} from "../preflight/runtime.js";
import { buildGenerateInitialOutlineMessages } from "./prompts/generateInitialOutlinePrompt.js";
import {
  buildReviseMasterOutlineMessages,
  buildReviseVolumeOutlineMessages,
} from "./prompts/reviseOutlinePrompt.js";
import type {
  GenerateInitialOutlineInput,
  GenerateInitialOutlineOutput,
  InitialOutlineJsonPayload,
  OutlineRevisionJsonPayload,
} from "./types.js";

const GENERATE_CAPABILITY_ID = "outline.generateInitialOutline";
const REVISE_MASTER_CAPABILITY_ID = "outline.reviseMasterOutline";
const REVISE_VOLUME_CAPABILITY_ID = "outline.reviseVolumeOutline";

export class OutlineAgent extends BaseAgent {
  readonly id = "outline";
  readonly name = "大纲 Agent";

  constructor(runtime: BaseAgentRuntime = {}) {
    super(runtime);
  }

  async generateInitialOutline(
    input: GenerateInitialOutlineInput,
  ): Promise<AgentCapabilityResult<GenerateInitialOutlineOutput>> {
    assertInput(input);
    const run = await this.completeWithTiming({
      messages: buildGenerateInitialOutlineMessages(input),
      temperature: 0.48,
      topP: 0.86,
      maxTokens: 7000,
      responseFormat: "json_object",
    });
    const parsed = parseJsonPayload<InitialOutlineJsonPayload>("OutlineAgent", run.completion.content);
    const master = parsed.masterOutline;
    if (!master || typeof master !== "object") {
      throw new Error("前置资产缺少 masterOutline");
    }

    const output = normalizeOutlineDraft(parsed, input.novelId);
    if (output.chapterPlans.length === 0) {
      throw new Error("前置资产缺少 chapterPlans");
    }

    return {
      output,
      run: buildRunMeta(this.id, GENERATE_CAPABILITY_ID, run),
    };
  }

  async reviseMasterOutline(
    input: ReviseMasterOutlineInput,
  ): Promise<AgentCapabilityResult<OutlineRevisionCandidate>> {
    assertRevisionInput(input);
    const run = await this.completeWithTiming({
      messages: buildReviseMasterOutlineMessages(input),
      temperature: 0.38,
      topP: 0.84,
      maxTokens: 9000,
      responseFormat: "json_object",
    });
    const parsed = parseJsonPayload<OutlineRevisionJsonPayload>("OutlineAgent", run.completion.content);
    return {
      output: normalizeRevisionCandidate(parsed, input.novelId),
      run: buildRunMeta(this.id, REVISE_MASTER_CAPABILITY_ID, run),
    };
  }

  async reviseVolumeOutline(
    input: ReviseVolumeOutlineInput,
  ): Promise<AgentCapabilityResult<OutlineRevisionCandidate>> {
    assertRevisionInput(input);
    if (!input.volumeId.trim()) {
      throw new Error("volumeId 不能为空");
    }
    if (!input.sourceOutline.volumes.some((volume) => volume.id === input.volumeId)) {
      throw new Error(`未找到目标卷：${input.volumeId}`);
    }
    const run = await this.completeWithTiming({
      messages: buildReviseVolumeOutlineMessages(input),
      temperature: 0.36,
      topP: 0.82,
      maxTokens: 8000,
      responseFormat: "json_object",
    });
    const parsed = parseJsonPayload<OutlineRevisionJsonPayload>("OutlineAgent", run.completion.content);
    const candidate = normalizeRevisionCandidate(parsed, input.novelId);
    return {
      output: preserveVolumeRevisionBoundaries(input, candidate),
      run: buildRunMeta(this.id, REVISE_VOLUME_CAPABILITY_ID, run),
    };
  }

  private async completeWithTiming(input: ChatCompletionInput): Promise<CompletionWithTiming> {
    const model = await this.getModel();
    const startedAt = this.getNow().toISOString();
    const completion = await model.complete(input);
    const finishedAt = this.getNow().toISOString();
    return { completion, startedAt, finishedAt };
  }
}

export const generateInitialOutlineCapability: AgentCapability<
  GenerateInitialOutlineInput,
  GenerateInitialOutlineOutput
> = {
  id: GENERATE_CAPABILITY_ID,
  description: "生成全书粗总纲、分卷规划和第一批章纲草案。",
  async run(input, runtime) {
    return new OutlineAgent(runtime).generateInitialOutline(input);
  },
};

export const reviseMasterOutlineCapability: AgentCapability<
  ReviseMasterOutlineInput,
  OutlineRevisionCandidate
> = {
  id: REVISE_MASTER_CAPABILITY_ID,
  description: "根据自然语言指令生成总纲修改候选及影响分析。",
  async run(input, runtime) {
    return new OutlineAgent(runtime).reviseMasterOutline(input);
  },
};

export const reviseVolumeOutlineCapability: AgentCapability<
  ReviseVolumeOutlineInput,
  OutlineRevisionCandidate
> = {
  id: REVISE_VOLUME_CAPABILITY_ID,
  description: "根据自然语言指令生成指定卷纲修改候选及影响分析。",
  async run(input, runtime) {
    return new OutlineAgent(runtime).reviseVolumeOutline(input);
  },
};

function assertInput(input: GenerateInitialOutlineInput) {
  if (!input.novelId.trim()) {
    throw new Error("novelId 不能为空");
  }
  if (input.foundation.novelId !== input.novelId || input.setting.novelId !== input.novelId) {
    throw new Error("前置资产 novelId 不一致");
  }
}

function assertRevisionInput(input: ReviseMasterOutlineInput) {
  if (!input.novelId.trim()) {
    throw new Error("novelId 不能为空");
  }
  if (!input.instruction.trim()) {
    throw new Error("instruction 不能为空");
  }
  if (
    input.foundation.novelId !== input.novelId
    || input.setting.novelId !== input.novelId
    || input.sourceOutline.novelId !== input.novelId
  ) {
    throw new Error("大纲修改输入的 novelId 不一致");
  }
  if (input.protectedChapterPlans.some((plan) => plan.novelId !== input.novelId)) {
    throw new Error("受保护章纲的 novelId 不一致");
  }
}

function normalizeOutlineDraft(
  value: Partial<InitialOutlineDraft>,
  novelId: string,
): InitialOutlineDraft {
  const master = value.masterOutline;
  if (!master || typeof master !== "object") {
    throw new Error("前置资产缺少 masterOutline");
  }
  const volumes = normalizeVolumes(value.volumes);
  return {
    novelId,
    masterOutline: {
      opening: requiredText(master.opening, "masterOutline.opening"),
      mainGoal: requiredText(master.mainGoal, "masterOutline.mainGoal"),
      escalation: requiredText(master.escalation, "masterOutline.escalation"),
      climax: requiredText(master.climax, "masterOutline.climax"),
      ending: requiredText(master.ending, "masterOutline.ending"),
      protagonistArc: requiredText(master.protagonistArc, "masterOutline.protagonistArc"),
    },
    volumes,
    chapterPlans: normalizeChapterPlans(value.chapterPlans, novelId, volumes),
    timelineEvents: normalizeTimeline(value.timelineEvents),
    foreshadowing: normalizeForeshadowing(value.foreshadowing),
    issues: normalizeIssues(value.issues),
    status: "待确认",
  };
}

function normalizeRevisionCandidate(
  value: OutlineRevisionJsonPayload,
  novelId: string,
): OutlineRevisionCandidate {
  if (!value.revisedOutline || typeof value.revisedOutline !== "object") {
    throw new Error("大纲修改结果缺少 revisedOutline");
  }
  return {
    revisedOutline: normalizeOutlineDraft(value.revisedOutline, novelId),
    diffSummary: stringArray(value.diffSummary),
    impactAnalysis: normalizeImpactAnalysis(value.impactAnalysis),
    chapterNumberChanges: normalizeChapterNumberChanges(value.chapterNumberChanges),
  };
}

function normalizeImpactAnalysis(
  value: OutlineRevisionJsonPayload["impactAnalysis"],
): OutlineRevisionCandidate["impactAnalysis"] {
  return {
    affectedVolumeIds: stringArray(value?.affectedVolumeIds),
    affectedChapterPlanIds: stringArray(value?.affectedChapterPlanIds),
    affectedTimelineEventIds: stringArray(value?.affectedTimelineEventIds),
    affectedForeshadowingIds: stringArray(value?.affectedForeshadowingIds),
    structuralChanges: stringArray(value?.structuralChanges),
    conflicts: normalizeRevisionConflicts(value?.conflicts),
    idMappings: normalizeIdMappings(value?.idMappings),
  };
}

function normalizeRevisionConflicts(value: unknown): OutlineRevisionConflict[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<OutlineRevisionConflict>;
    const description = optionalText(candidate.description);
    if (!description) return [];
    return [{
      id: optionalText(candidate.id) || `outline-revision-conflict-${index + 1}`,
      severity: candidate.severity === "critical" || candidate.severity === "info"
        ? candidate.severity
        : "warning",
      category: optionalText(candidate.category) || "structure",
      description,
      suggestion: optionalText(candidate.suggestion) || "调整修改指令后重新生成候选版本。",
    }];
  });
}

function normalizeIdMappings(value: unknown): OutlineStructureIdMapping[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<OutlineStructureIdMapping>;
    const sourceIds = stringArray(candidate.sourceIds);
    const targetIds = stringArray(candidate.targetIds);
    if (sourceIds.length === 0 && targetIds.length === 0) return [];
    return [{
      kind: candidate.kind === "chapter" ? "chapter" : "volume",
      sourceIds,
      targetIds,
    }];
  });
}

function normalizeChapterNumberChanges(value: unknown): ChapterNumberChange[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<ChapterNumberChange>;
    const chapterPlanId = optionalText(candidate.chapterPlanId);
    if (
      !chapterPlanId
      || typeof candidate.from !== "number"
      || typeof candidate.to !== "number"
    ) {
      return [];
    }
    return [{
      chapterPlanId,
      from: Math.floor(candidate.from),
      to: Math.floor(candidate.to),
    }];
  });
}

function preserveVolumeRevisionBoundaries(
  input: ReviseVolumeOutlineInput,
  candidate: OutlineRevisionCandidate,
): OutlineRevisionCandidate {
  const source = input.sourceOutline;
  const rawOutline = candidate.revisedOutline;
  const conflicts = [...candidate.impactAnalysis.conflicts];
  if (JSON.stringify(rawOutline.masterOutline) !== JSON.stringify(source.masterOutline)) {
    conflicts.push(revisionScopeConflict(
      "volume-master-overreach",
      "master_outline_overreach",
      "卷纲修改候选越权修改了总纲。",
    ));
  }
  const sourceOtherVolumes = source.volumes.filter((volume) => volume.id !== input.volumeId);
  const rawOtherVolumes = rawOutline.volumes.filter((volume) => volume.id !== input.volumeId);
  if (JSON.stringify(rawOtherVolumes) !== JSON.stringify(sourceOtherVolumes)) {
    conflicts.push(revisionScopeConflict(
      "volume-cross-scope",
      "cross_volume_change",
      "卷纲修改候选越权修改、新增或删除了其他卷。",
    ));
  }
  for (const sourcePlan of source.chapterPlans.filter((plan) =>
    resolvePlanVolumeId(plan, source.volumes) !== input.volumeId
  )) {
    const rawPlan = rawOutline.chapterPlans.find((plan) => plan.id === sourcePlan.id);
    if (!rawPlan || !sameChapterPlanContent(rawPlan, sourcePlan, source.volumes)) {
      conflicts.push(revisionScopeConflict(
        `volume-cross-chapter-${sourcePlan.id}`,
        "cross_volume_change",
        `卷纲修改候选越权修改或删除了其他卷章纲：${sourcePlan.id}。`,
      ));
    }
  }

  const sourceTargetVolume = source.volumes.find((volume) => volume.id === input.volumeId)!;
  const targetVolume = rawOutline.volumes.find((volume) => volume.id === input.volumeId)
    ?? sourceTargetVolume;
  if (!rawOutline.volumes.some((volume) => volume.id === input.volumeId)) {
    conflicts.push(revisionScopeConflict(
      "volume-target-deleted",
      "volume_scope",
      `卷纲修改不能删除目标卷：${input.volumeId}。`,
    ));
  }
  const targetTitle = targetVolume.title;
  const targetPlans = rawOutline.chapterPlans.filter((plan) =>
    plan.volumeId === input.volumeId
    || plan.volumeTitle === targetTitle
    || plan.volumeTitle === sourceTargetVolume.title
  ).map((plan) => ({
    ...plan,
    volumeId: input.volumeId,
    volumeTitle: targetTitle,
  }));
  const sourceOtherPlans = source.chapterPlans.filter((plan) =>
    resolvePlanVolumeId(plan, source.volumes) !== input.volumeId
  );

  return {
    ...candidate,
    impactAnalysis: {
      ...candidate.impactAnalysis,
      conflicts: Array.from(new Map(conflicts.map((conflict) => [conflict.id, conflict])).values()),
    },
    revisedOutline: {
      ...rawOutline,
      masterOutline: source.masterOutline,
      volumes: source.volumes.map((volume) =>
        volume.id === input.volumeId ? targetVolume : volume
      ),
      chapterPlans: [...sourceOtherPlans, ...targetPlans],
      timelineEvents: mergeScopedItems(
        source.timelineEvents,
        rawOutline.timelineEvents,
        input.volumeId,
      ),
      foreshadowing: mergeScopedItems(
        source.foreshadowing,
        rawOutline.foreshadowing,
        input.volumeId,
      ),
    },
  };
}

function revisionScopeConflict(
  id: string,
  category: string,
  description: string,
): OutlineRevisionConflict {
  return {
    id,
    severity: "critical",
    category,
    description,
    suggestion: "保留总纲和其他卷不变；如需扩大修改范围，请另开总纲修改任务。",
  };
}

function sameChapterPlanContent(
  left: InitialOutlineDraft["chapterPlans"][number],
  right: InitialOutlineDraft["chapterPlans"][number],
  volumes: VolumePlanDraft[],
) {
  return left.title === right.title
    && left.objective === right.objective
    && left.hook === right.hook
    && left.status === right.status
    && resolvePlanVolumeId(left, volumes) === resolvePlanVolumeId(right, volumes);
}

function resolvePlanVolumeId(
  plan: InitialOutlineDraft["chapterPlans"][number],
  volumes: VolumePlanDraft[],
) {
  return plan.volumeId || volumes.find((volume) => volume.title === plan.volumeTitle)?.id || "";
}

function mergeScopedItems<T extends { volumeId?: string }>(
  source: T[],
  candidate: T[],
  targetVolumeId: string,
) {
  return [
    ...source.filter((item) => item.volumeId !== targetVolumeId),
    ...candidate.filter((item) => item.volumeId === targetVolumeId),
  ];
}

function normalizeVolumes(value: unknown): VolumePlanDraft[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<VolumePlanDraft>;
    const title = optionalText(candidate.title);
    const goal = optionalText(candidate.goal);
    if (!title || !goal) return [];
    return [{
      id: optionalText(candidate.id) || `volume-${index + 1}`,
      title,
      goal,
      conflict: optionalText(candidate.conflict),
      highlights: stringArray(candidate.highlights),
      chapterRange: optionalText(candidate.chapterRange),
      status: candidate.status === "推进中" || candidate.status === "已完成" ? candidate.status : "未开始",
    }];
  });
}

function normalizeChapterPlans(
  value: unknown,
  novelId: string,
  volumes: VolumePlanDraft[],
): InitialOutlineDraft["chapterPlans"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<InitialOutlineDraft["chapterPlans"][number]>;
    const objective = optionalText(candidate.objective);
    const hook = optionalText(candidate.hook);
    if (!objective || !hook) return [];
    const chapterNo = typeof candidate.chapterNo === "number" && candidate.chapterNo > 0
      ? Math.floor(candidate.chapterNo)
      : index + 1;
    const volumeTitle = optionalText(candidate.volumeTitle) || volumes[0]?.title || "第一卷";
    const matchedVolume = volumes.find((volume) => volume.id === candidate.volumeId)
      ?? volumes.find((volume) => volume.title === volumeTitle)
      ?? volumes[0];
    return [{
      id: optionalText(candidate.id) || `chapter-plan-${novelId}-${chapterNo}`,
      novelId,
      chapterNo,
      title: optionalText(candidate.title) || `第 ${chapterNo} 章`,
      volumeId: optionalText(candidate.volumeId) || matchedVolume?.id || "volume-1",
      volumeTitle,
      objective,
      hook,
      status: "草稿",
    }];
  });
}

function normalizeTimeline(value: unknown): TimelineEventDraft[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<TimelineEventDraft>;
    const title = optionalText(candidate.title);
    const summary = optionalText(candidate.summary);
    if (!title || !summary) return [];
    return [{
      id: optionalText(candidate.id) || `timeline-${index + 1}`,
      volumeId: optionalText(candidate.volumeId) || undefined,
      title,
      storyTime: optionalText(candidate.storyTime),
      narrativePosition: optionalText(candidate.narrativePosition),
      summary,
      characters: stringArray(candidate.characters),
      causality: optionalText(candidate.causality),
      canon: false,
      risk: optionalText(candidate.risk) || undefined,
    }];
  });
}

function normalizeForeshadowing(value: unknown): ForeshadowingDraft[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<ForeshadowingDraft>;
    const title = optionalText(candidate.title);
    const summary = optionalText(candidate.summary);
    if (!title || !summary) return [];
    return [{
      id: optionalText(candidate.id) || `foreshadowing-${index + 1}`,
      volumeId: optionalText(candidate.volumeId) || undefined,
      title,
      plantedAt: optionalText(candidate.plantedAt),
      payoffAt: optionalText(candidate.payoffAt),
      status: candidate.status === "推进中" || candidate.status === "待回收" || candidate.status === "已回收" || candidate.status === "风险"
        ? candidate.status
        : "已埋设",
      summary,
      relatedCharacters: stringArray(candidate.relatedCharacters),
      risk: optionalText(candidate.risk) || undefined,
    }];
  });
}

function normalizeIssues(value: unknown): OutlineIssueDraft[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<OutlineIssueDraft>;
    const detail = optionalText(candidate.detail);
    if (!detail) return [];
    return [{
      id: optionalText(candidate.id) || `outline-issue-${index + 1}`,
      level: candidate.level === "风险" || candidate.level === "关注" ? candidate.level : "健康",
      title: optionalText(candidate.title) || "结构检查",
      detail,
    }];
  });
}
