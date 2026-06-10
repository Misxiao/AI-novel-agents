import type {
  ChatCompletionInput,
  ChatCompletionOutput,
  ChatModel,
  InitialOutlineDraft,
} from "../../../agents/src/index.js";
import type { CliCommandContext } from "./types.js";

export const createCliMockModel: NonNullable<CliCommandContext["createMockModel"]> = (
  capability,
  novelId,
  options = {},
) => {
  const payloads = capability === "preflight"
    ? buildPreflightPayloads(
        novelId,
        options.chapterPlanCount ?? 12,
        options.targetWords,
      )
    : capability === "chapter-write"
      ? buildChapterPayloads(options.hasExistingChapterPlan)
      : buildRevisionPayloads(
          novelId,
          options.sourceOutline,
          options.instruction ?? "修改大纲",
          capability,
          options.volumeId,
        );
  let index = 0;
  return {
    provider: "mock",
    model: `cli-${capability}-mock`,
    async complete(input: ChatCompletionInput): Promise<ChatCompletionOutput> {
      const payload = payloads[index++];
      if (payload === undefined) {
        throw new Error(`没有为 ${capability} 的第 ${index} 次调用准备 mock payload。`);
      }
      const content = JSON.stringify(payload);
      const promptTokens = input.messages.reduce(
        (sum, message) => sum + message.content.length,
        0,
      );
      return {
        provider: "mock",
        model: `cli-${capability}-mock`,
        content,
        usage: {
          promptTokens,
          completionTokens: content.length,
          totalTokens: promptTokens + content.length,
        },
      };
    },
  };
};

function buildPreflightPayloads(
  novelId: string,
  count: number,
  targetWords?: number,
): unknown[] {
  const chapterPlanCount = Math.min(20, Math.max(10, count));
  return [
    {
      novelId,
      titleCandidates: ["裂界回声", "失忆封印者"],
      synopsis: "沈砚必须在记忆耗尽前关闭不断扩张的裂界。",
      hook: "每次封印裂界都会永久失去一段重要记忆。",
      sellingPoint: "封印代价与真相追查同步升级。",
      premise: "城市被裂界封锁，主角是唯一能触碰封印的人。",
      mainConflict: "主角必须在彻底失忆前关闭裂界并找出制造者。",
      storyEngine: "每次处理新裂界都会获得线索，同时失去个人记忆。",
      targetReaders: "喜欢玄幻悬疑与规则代价的读者",
      tone: "紧张、克制、行动驱动",
      targetWords: targetWords ?? 120000,
      estimatedChapters: Math.max(1, Math.ceil((targetWords ?? 120000) / 2500)),
      estimatedVolumes: 3,
      chapterWordTarget: 2500,
      risks: [],
      questionsForAuthor: [],
      status: "待确认",
    },
    reviewPayload("基础盘具备持续冲突。"),
    {
      novelId,
      background: "裂界正在吞噬城市边缘，封印依赖人的记忆。",
      worldRules: ["封印必须支付记忆", "同一裂界不能被重复封印"],
      powerSystem: "记忆化作封印纹路。",
      factions: ["守界司", "拾忆会"],
      locations: ["旧城裂界", "守界司档案库"],
      constraints: ["失去的记忆不能无代价恢复"],
      characterSeeds: [{
        id: "character-protagonist",
        name: "沈砚",
        role: "主角",
        desire: "关闭裂界",
        conflict: "持续失忆",
        initialState: "第一次主动封印",
        arcHint: "从独自承担到建立共同记忆",
      }],
      relationshipSeeds: [],
      styleGuidance: ["短段落", "动作优先"],
      forbiddenExpressions: ["命运的齿轮开始转动"],
      canonCandidates: ["封印必然消耗记忆"],
      risks: [],
      status: "待确认",
    },
    reviewPayload("设定边界清楚。"),
    createOutline(novelId, chapterPlanCount),
    reviewPayload("初始大纲可进入人工确认。"),
  ];
}

function buildRevisionPayloads(
  novelId: string,
  sourceOutline: InitialOutlineDraft | undefined,
  instruction: string,
  capability: "revise-master" | "revise-volume",
  volumeId?: string,
): unknown[] {
  if (!sourceOutline) {
    throw new Error("mock 大纲修改缺少源大纲。");
  }
  const revisedOutline = structuredClone(sourceOutline);
  const affectedVolumeIds: string[] = [];
  if (capability === "revise-master") {
    revisedOutline.masterOutline.escalation = `${revisedOutline.masterOutline.escalation}\n修改草案：${instruction}`;
    affectedVolumeIds.push(...revisedOutline.volumes.map((volume) => volume.id));
  } else {
    const volume = revisedOutline.volumes.find((item) => item.id === volumeId);
    if (!volume) {
      throw new Error(`未找到目标卷：${volumeId}`);
    }
    volume.goal = `${volume.goal}\n修改草案：${instruction}`;
    affectedVolumeIds.push(volume.id);
  }
  return [
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
    reviewPayload("修改候选通过结构评审。", 90),
  ];
}

function buildChapterPayloads(hasExistingChapterPlan = false): unknown[] {
  const content = [
    "沈砚停在裂界门前，没有立刻伸手。",
    "门后出现失踪盟友留下的血字，字迹还在缓慢渗开。",
    "他用旧钥匙压住封印纹路，逼裂界先吐出一段不属于他的记忆。",
    "记忆里，盟友回头看向他，低声说出守界司从未记录的名字。",
    "沈砚记下那个名字，门后的血字却忽然变成了他的笔迹。",
  ].join("\n\n");
  const review = {
    passed: true,
    overallScore: 90,
    summary: "章节完成目标并留下明确钩子。",
    strengths: ["动作明确", "章末有变化"],
    issues: [],
    moduleFindings: [],
    requiredRevisionInstruction: "",
    warnings: [],
  };
  const payloads = [
    {
      title: "门后的血字",
      volumeTitle: "第一卷",
      objective: "主角主动试探裂界并找到盟友留下的线索。",
      hook: "门后出现失踪盟友留下的血字。",
      status: "草稿",
      warnings: [],
    },
    {
      viewpoint: "沈砚贴身视角",
      objective: "主动试探裂界。",
      obstacle: "封印会消耗记忆。",
      change: "主角得到盟友线索。",
      sceneBeats: [{
        sceneNo: 1,
        purpose: "试探裂界",
        conflict: "记忆代价",
        change: "发现血字",
        keyCharacters: ["沈砚"],
      }],
      rewardMoment: "裂界吐出隐藏记忆。",
      endingHook: "门后出现失踪盟友留下的血字。",
      riskNotes: [],
      warnings: [],
    },
    {
      title: "门后的血字",
      content,
      summary: "沈砚主动试探裂界，发现失踪盟友留下的血字和隐藏名字。",
      warnings: [],
    },
    review,
  ];
  if (hasExistingChapterPlan) {
    return [
      ...payloads.slice(1),
      {
        title: "门后的血字",
        content,
        summary: "沈砚主动试探裂界，发现失踪盟友留下的血字和隐藏名字。",
        changedSummary: "补强动作和章末钩子。",
        handledIssueIds: [],
        unresolvedRisks: [],
        warnings: [],
      },
      review,
    ];
  }
  return payloads;
}

function createOutline(novelId: string, chapterPlanCount: number): InitialOutlineDraft {
  return {
    novelId,
    masterOutline: {
      opening: "旧城第一道裂界失控。",
      mainGoal: "关闭裂界并找到制造者。",
      escalation: "从单点封印升级为全城裂界连锁。",
      climax: "主角用最后的私人记忆封住裂界核心。",
      ending: "裂界关闭，共同记录保存了主角身份。",
      protagonistArc: "从独自承担到相信共同记忆。",
    },
    volumes: [{
      id: "volume-1",
      title: "第一卷：旧城裂口",
      goal: "关闭旧城裂界并找到失踪盟友。",
      conflict: "守界司内部隐藏真相。",
      highlights: ["第一次主动封印"],
      chapterRange: `1-${chapterPlanCount}`,
      status: "未开始",
    }],
    chapterPlans: Array.from({ length: chapterPlanCount }, (_, index) => ({
      id: `chapter-plan-${index + 1}`,
      novelId,
      chapterNo: index + 1,
      title: `第 ${index + 1} 章`,
      volumeId: "volume-1",
      volumeTitle: "第一卷：旧城裂口",
      objective: `推进裂界线索 ${index + 1}`,
      hook: `留下裂界疑问 ${index + 1}`,
      status: "草稿",
    })),
    timelineEvents: [],
    foreshadowing: [],
    issues: [],
    status: "待确认",
  };
}

function reviewPayload(summary: string, score = 88) {
  return {
    passed: true,
    overallScore: score,
    summary,
    strengths: ["结构清楚"],
    issues: [],
    requiredRevisionInstruction: "",
    warnings: [],
  };
}
