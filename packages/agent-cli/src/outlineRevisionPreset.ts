import type {
  ChatCompletionInput,
  ChatCompletionOutput,
  ChatModel,
  InitialOutlineDraft,
  OutlineRevisionScope,
} from "../../agents/src/index.js";
import { NovelDatabase } from "../../db/src/index.js";
import { NovelPreflightRepository } from "../../repositories/src/index.js";
import {
  runReviseMasterOutlineWorkflow,
  runReviseVolumeOutlineWorkflow,
  type OutlineRevisionVersion,
} from "../../workflow/src/index.js";

export interface OutlineRevisionCliOptions {
  novelId: string;
  scope: OutlineRevisionScope;
  volumeId?: string;
  instruction: string;
  sourceVersionId?: string;
  mock: boolean;
  json: boolean;
}

export interface OutlineRevisionSummaryInput {
  versionId: string;
  sourceVersionId?: string;
  scope: OutlineRevisionScope;
  targetVolumeId?: string;
  status: "待确认" | "需修订" | "已确认";
  reviewScore: number;
  diffSummary: string[];
  conflicts: string[];
  chapterNumberChangeCount: number;
  agentRunCount: number;
}

export function parseOutlineRevisionArgs(args: string[]): OutlineRevisionCliOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const equalsIndex = arg.indexOf("=");
    if (equalsIndex < 0) {
      flags.add(arg.slice(2));
    } else {
      values.set(arg.slice(2, equalsIndex), arg.slice(equalsIndex + 1));
    }
  }

  const novelId = values.get("novel-id")?.trim() || "";
  const instruction = values.get("instruction")?.trim() || "";
  const scope = values.get("scope")?.trim();
  const volumeId = values.get("volume-id")?.trim() || undefined;
  if (!novelId) throw new Error("必须传入 --novel-id=小说ID。");
  if (!instruction) throw new Error("必须传入 --instruction=修改指令。");
  if (scope !== "master" && scope !== "volume") {
    throw new Error("--scope 必须是 master 或 volume。");
  }
  if (scope === "volume" && !volumeId) {
    throw new Error("卷纲修改必须传入 --volume-id=卷ID。");
  }

  return {
    novelId,
    scope,
    ...(volumeId ? { volumeId } : {}),
    instruction,
    ...(values.get("source-version-id")?.trim()
      ? { sourceVersionId: values.get("source-version-id")!.trim() }
      : {}),
    mock: flags.has("mock"),
    json: flags.has("json"),
  };
}

export function buildOutlineRevisionSummary(input: OutlineRevisionSummaryInput) {
  return [
    "[workflow.outlineRevision]",
    `版本: ${input.versionId}`,
    `源版本: ${input.sourceVersionId || "初始大纲草案"}`,
    `范围: ${input.scope}${input.targetVolumeId ? ` / ${input.targetVolumeId}` : ""}`,
    `状态: ${input.status}`,
    `评审分数: ${input.reviewScore}`,
    `修改摘要: ${input.diffSummary.join("；") || "暂无"}`,
    `结构冲突: ${input.conflicts.join("；") || "暂无"}`,
    `编号变化: ${input.chapterNumberChangeCount}`,
    `Agent Runs: ${input.agentRunCount}`,
  ].join("\n");
}

async function main() {
  const options = parseOutlineRevisionArgs(process.argv.slice(2));
  const repository = new NovelPreflightRepository(new NovelDatabase());
  const sourceOutline = options.mock
    ? resolveSourceOutline(repository, options.novelId, options.sourceVersionId)
    : undefined;
  const model = sourceOutline
    ? createMockModel(sourceOutline, options.scope, options.volumeId, options.instruction)
    : undefined;
  const result = options.scope === "master"
    ? await runReviseMasterOutlineWorkflow({
        novelId: options.novelId,
        instruction: options.instruction,
        sourceVersionId: options.sourceVersionId,
        model,
        repository,
      })
    : await runReviseVolumeOutlineWorkflow({
        novelId: options.novelId,
        volumeId: options.volumeId!,
        instruction: options.instruction,
        sourceVersionId: options.sourceVersionId,
        model,
        repository,
      });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(buildOutlineRevisionSummary({
    versionId: result.version.versionId,
    sourceVersionId: result.version.sourceVersionId,
    scope: result.version.scope,
    targetVolumeId: result.version.targetVolumeId,
    status: result.version.status,
    reviewScore: result.version.review.overallScore,
    diffSummary: result.version.diffSummary,
    conflicts: result.version.impactAnalysis.conflicts.map((conflict) => conflict.description),
    chapterNumberChangeCount: result.version.chapterNumberChanges.length,
    agentRunCount: result.agentRuns.length,
  }));
}

function resolveSourceOutline(
  repository: NovelPreflightRepository,
  novelId: string,
  sourceVersionId?: string,
) {
  if (sourceVersionId) {
    const version = repository.getOutlineVersion<OutlineRevisionVersion>(
      novelId,
      sourceVersionId,
    );
    if (!version) throw new Error(`未找到大纲版本：${sourceVersionId}`);
    return version.version.revisedOutline;
  }
  const latest = repository.getLatestOutlineVersion<OutlineRevisionVersion>(novelId);
  if (latest) return latest.version.revisedOutline;
  const draft = repository.getDraft<InitialOutlineDraft>(novelId, "outline");
  if (!draft) throw new Error(`小说缺少 outline 前置资产草案：${novelId}`);
  return draft.asset;
}

function createMockModel(
  sourceOutline: InitialOutlineDraft,
  scope: OutlineRevisionScope,
  volumeId: string | undefined,
  instruction: string,
): ChatModel {
  const revisedOutline = structuredClone(sourceOutline);
  const affectedVolumeIds: string[] = [];
  if (scope === "master") {
    revisedOutline.masterOutline.escalation = [
      revisedOutline.masterOutline.escalation,
      `修改草案：${instruction}`,
    ].filter(Boolean).join("\n");
    affectedVolumeIds.push(...revisedOutline.volumes.map((volume) => volume.id));
  } else {
    const targetVolume = revisedOutline.volumes.find((volume) => volume.id === volumeId);
    if (!targetVolume) throw new Error(`未找到目标卷：${volumeId}`);
    targetVolume.goal = `${targetVolume.goal}\n修改草案：${instruction}`;
    affectedVolumeIds.push(targetVolume.id);
  }
  const payloads: unknown[] = [
    {
      revisedOutline,
      diffSummary: [instruction],
      impactAnalysis: {
        affectedVolumeIds,
        affectedChapterPlanIds: [],
        affectedTimelineEventIds: [],
        affectedForeshadowingIds: [],
        structuralChanges: [],
        conflicts: [],
        idMappings: [],
      },
      chapterNumberChanges: [],
    },
    {
      passed: true,
      overallScore: 90,
      summary: "Mock 修改候选通过结构评审。",
      strengths: ["修改范围清楚"],
      issues: [],
      requiredRevisionInstruction: "",
      warnings: [],
    },
  ];
  let index = 0;
  return {
    provider: "mock",
    model: "outline-revision-cli",
    async complete(input: ChatCompletionInput): Promise<ChatCompletionOutput> {
      const payload = payloads[index++];
      if (payload === undefined) {
        throw new Error(`没有为第 ${index} 次模型调用准备 mock payload。`);
      }
      const content = JSON.stringify(payload);
      const promptTokens = input.messages.reduce((sum, message) => sum + message.content.length, 0);
      return {
        provider: "mock",
        model: "outline-revision-cli",
        content,
        usage: {
          promptTokens,
          completionTokens: content.length,
          totalTokens: promptTokens + content.length,
        },
      };
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
