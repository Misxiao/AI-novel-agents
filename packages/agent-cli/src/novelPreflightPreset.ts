import type {
  ChatCompletionInput,
  ChatCompletionOutput,
  ChatModel,
} from "../../agents/src/index.js";
import { NovelDatabase } from "../../db/src/index.js";
import { NovelPreflightRepository } from "../../repositories/src/index.js";
import { runNovelPreflightWorkflow } from "../../workflow/src/index.js";

export interface NovelPreflightCliOptions {
  novelId?: string;
  seedNotes: string;
  targetWords?: number;
  volumeCount: number;
  mock: boolean;
  json: boolean;
}

export interface NovelPreflightSummaryInput {
  novelId: string;
  titleCandidates: string[];
  synopsis: string;
  volumeCount: number;
  reviewScores: {
    foundation: number;
    setting: number;
    outline: number;
  };
  risks: string[];
  agentRunCount: number;
}

export function parseNovelPreflightArgs(args: string[]): NovelPreflightCliOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (const arg of args) {
    if (!arg.startsWith("--")) {
      continue;
    }
    const equalsIndex = arg.indexOf("=");
    if (equalsIndex === -1) {
      flags.add(arg.slice(2));
    } else {
      values.set(arg.slice(2, equalsIndex), arg.slice(equalsIndex + 1));
    }
  }

  const seedNotes = values.get("seed-notes")?.trim() || "";
  if (!seedNotes) {
    throw new Error("必须传入 --seed-notes=初步想法。");
  }

  return {
    novelId: values.get("novel-id")?.trim() || undefined,
    seedNotes,
    targetWords: parsePositiveInteger(values.get("target-words"), "target-words"),
    volumeCount: parsePositiveInteger(values.get("volumes"), "volumes") ?? 0,
    mock: flags.has("mock"),
    json: flags.has("json"),
  };
}

export function buildNovelPreflightSummary(input: NovelPreflightSummaryInput) {
  return [
    "[workflow.novelPreflight]",
    `novelId: ${input.novelId}`,
    `标题候选: ${input.titleCandidates.join(" / ") || "暂无"}`,
    `简介: ${input.synopsis}`,
    `分卷: ${input.volumeCount}`,
    `评审分数: 基础盘 ${input.reviewScores.foundation} / 设定 ${input.reviewScores.setting} / 大纲 ${input.reviewScores.outline}`,
    `风险: ${input.risks.join("；") || "暂无"}`,
    `Agent Runs: ${input.agentRunCount}`,
    "状态: 等待用户确认",
  ].join("\n");
}

async function main() {
  const options = parseNovelPreflightArgs(process.argv.slice(2));
  const repository = new NovelPreflightRepository(new NovelDatabase());
  const novelId = options.novelId ?? repository.createEmptyNovel().novelId;
  if (options.volumeCount < 1) {
    throw new Error("必须传入 --volumes=卷数。");
  }
  const model = options.mock ? createMockModel(novelId, options.volumeCount) : undefined;
  const result = await runNovelPreflightWorkflow({
    novelId,
    seedNotes: options.seedNotes,
    targetWords: options.targetWords,
    volumeCount: options.volumeCount,
    model,
    repository,
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(buildNovelPreflightSummary({
    novelId,
    titleCandidates: result.foundationDraft.titleCandidates,
    synopsis: result.foundationDraft.synopsis,
    volumeCount: result.outlineDraft.volumes.length,
    reviewScores: {
      foundation: result.reviews.foundation.overallScore,
      setting: result.reviews.setting.overallScore,
      outline: result.reviews.outline.overallScore,
    },
    risks: [
      ...result.foundationDraft.risks,
      ...result.settingDraft.risks,
      ...result.outlineDraft.issues
        .filter((issue) => issue.level !== "健康")
        .map((issue) => issue.detail),
    ],
    agentRunCount: result.agentRuns.length,
  }));
}

function createMockModel(novelId: string, volumeCount: number): ChatModel {
  const payloads = buildMockPayloads(novelId, volumeCount);
  let index = 0;
  return {
    provider: "mock",
    model: "novel-preflight-cli",
    async complete(input: ChatCompletionInput): Promise<ChatCompletionOutput> {
      const payload = payloads[index++];
      if (payload === undefined) {
        throw new Error(`没有为第 ${index} 次模型调用准备 mock payload。`);
      }
      const content = JSON.stringify(payload);
      const promptTokens = input.messages.reduce((sum, message) => sum + message.content.length, 0);
      return {
        provider: "mock",
        model: "novel-preflight-cli",
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

function buildMockPayloads(novelId: string, volumeCount: number): unknown[] {
  const review = (summary: string) => ({
    passed: true,
    overallScore: 88,
    summary,
    strengths: ["核心冲突明确"],
    issues: [],
    requiredRevisionInstruction: "",
    warnings: [],
  });
  return [
    {
      novelId,
      titleCandidates: ["三日前死局", "回档失忆者"],
      synopsis: "沈砚在一次次死亡回档中，用不断消失的记忆追查宗门灭门真相。",
      hook: "每次死亡回到三日前，但会随机失去一段重要记忆。",
      sellingPoint: "回档带来情报优势，失忆持续破坏优势。",
      premise: "灵气枯竭时代，主角被困在宗门灭门前三日。",
      mainConflict: "主角必须在彻底遗忘真相前阻止灭门。",
      storyEngine: "每轮回档获得新线索，同时失去旧认知。",
      targetReaders: "喜欢玄幻升级与悬疑反转的读者",
      tone: "紧张、克制、行动驱动",
      targetWords: 360000,
      plannedVolumes: volumeCount,
      risks: [],
      questionsForAuthor: ["回档最终是否必须终止？"],
      status: "待确认",
    },
    review("基础盘具备持续生产能力。"),
    {
      novelId,
      background: "灵气枯竭导致宗门围绕远古遗物展开争夺。",
      worldRules: ["死亡最多回到三日前", "每次回档必然失去一段记忆"],
      powerSystem: "修士以灵力驱动遗物，回档遗物额外消耗记忆。",
      factions: ["玄衡宗", "归墟会"],
      locations: ["玄衡山门", "归墟古井"],
      constraints: ["不能无代价恢复记忆"],
      characterSeeds: [{
        id: "character-1",
        name: "沈砚",
        role: "主角",
        desire: "阻止灭门",
        conflict: "记忆持续丢失",
        initialState: "第三次回档",
        arcHint: "从独行到建立可信关系",
      }],
      relationshipSeeds: [],
      styleGuidance: ["短段落", "动作优先"],
      forbiddenExpressions: ["命运的齿轮开始转动"],
      canonCandidates: ["灵气正在不可逆地枯竭"],
      risks: [],
      status: "待确认",
    },
    review("设定规则具备代价和边界。"),
    {
      novelId,
      masterOutline: {
        opening: "沈砚第三次从灭门前三日醒来。",
        mainGoal: "阻止灭门并查清回档源头。",
        escalation: "从宗门内鬼升级为跨宗门遗物争夺。",
        climax: "主角主动放弃关键记忆换取最后一次回档。",
        ending: "终止回档，由同伴保存共同真相。",
        protagonistArc: "从只相信自己的记忆到学会信任他人。",
      },
      volumes: Array.from({ length: volumeCount }, (_, index) => ({
        id: `volume-${index + 1}`,
        title: `第 ${index + 1} 卷`,
        goal: `完成阶段目标 ${index + 1}`,
        conflict: `矛盾升级 ${index + 1}`,
        highlights: [`阶段兑现 ${index + 1}`],
        stages: ["建立目标", "推进冲突", "重大转折", "阶段高潮", "卷末收束"],
        characterDevelopment: ["主角与伙伴关系发生阶段变化"],
        powerSystemProgression: "本卷推进一层力量体系并明确代价。",
        revelations: ["揭示一层世界真相"],
        endingOutcome: "完成本卷目标并留下更大危机。",
        nextVolumeHook: "新线索推动下一卷。",
        status: "未开始",
      })),
      chapterPlans: [],
      timelineEvents: [],
      foreshadowing: [],
      issues: [],
      status: "待确认",
    },
    review("大纲可以进入人工确认。"),
  ];
}

function parsePositiveInteger(value: string | undefined, name: string) {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${name} 必须为正数。`);
  }
  return Math.floor(parsed);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
