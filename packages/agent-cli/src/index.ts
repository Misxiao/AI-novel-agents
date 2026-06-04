import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";
import {
  ChapterAgent,
  type ChapterPlanInput,
  type ChapterContextPackage,
  type ChapterNovelInput,
  type ChatCompletionInput,
  type ChatCompletionOutput,
  type ChatModel,
} from "@ai-novel-agents/agents";

type DemoCommand =
  | "plan"
  | "write"
  | "revise"
  | "rewrite-scene"
  | "expand"
  | "compress"
  | "polish";

interface CliOptions {
  command: DemoCommand;
  mock: boolean;
  json: boolean;
  targetWords?: number;
}

const DEFAULT_COMMAND: DemoCommand = "write";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  loadLocalEnv();

  const model = options.mock ? createMockModel(options.command) : undefined;
  const agent = new ChapterAgent(model ? { model } : {});
  const result = await runDemoCommand(agent, options);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printReadableResult(options.command, result);
}

function parseArgs(args: string[]): CliOptions {
  const command = args.find((arg): arg is DemoCommand => isDemoCommand(arg)) ?? DEFAULT_COMMAND;
  const targetWordsArg = args.find((arg) => arg.startsWith("--target-words="));
  const targetWords = targetWordsArg ? Number(targetWordsArg.split("=")[1]) : undefined;

  return {
    command,
    mock: args.includes("--mock"),
    json: args.includes("--json"),
    targetWords: Number.isFinite(targetWords) ? targetWords : undefined,
  };
}

function isDemoCommand(value: string): value is DemoCommand {
  return ["plan", "write", "revise", "rewrite-scene", "expand", "compress", "polish"].includes(value);
}

function loadLocalEnv() {
  const envPath = findNearestFile(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  }
}

function findNearestFile(startDir: string, filename: string) {
  let currentDir = resolve(startDir);
  const rootDir = parse(currentDir).root;

  while (true) {
    const candidate = join(currentDir, filename);
    if (existsSync(candidate)) {
      return candidate;
    }

    if (existsSync(join(currentDir, "pnpm-workspace.yaml")) || currentDir === rootDir) {
      return candidate;
    }

    currentDir = dirname(currentDir);
  }
}

async function runDemoCommand(agent: ChapterAgent, options: CliOptions) {
  const targetWords = options.targetWords ?? defaultTargetWords(options.command);
  const baseInput = {
    novel: sampleNovel,
    chapterPlan: sampleChapterPlan,
    context: sampleContext,
    targetWords,
  };

  switch (options.command) {
    case "plan":
      return agent.planChapterDraft(baseInput);
    case "write":
      return agent.writeNextChapter(baseInput);
    case "revise":
      return agent.reviseChapter({
        ...baseInput,
        draft: sampleDraft,
        instruction: "把第一段的说明感压低，增加主角的行动和压力，不要改变回档规则。",
        reviewIssues: sampleReviewIssues,
      });
    case "rewrite-scene":
      return agent.rewriteScene({
        ...baseInput,
        draft: sampleDraft,
        instruction: "把场景改得更紧张，减少旁白解释。",
        reviewIssues: sampleReviewIssues,
        scene: {
          id: "scene-1",
          label: "醒来确认回档",
          originalText: "沈砚醒来后，意识到自己又回到了三日前。他开始回忆之前发生的一切。",
        },
      });
    case "expand":
      return agent.expandText({
        ...baseInput,
        draft: sampleDraft,
        targetWords,
        instruction: "扩写动作、关系压力和章末钩子，不新增重大设定。",
        reviewIssues: sampleReviewIssues,
      });
    case "compress":
      return agent.compressText({
        ...baseInput,
        draft: sampleDraft,
        targetWords,
        instruction: "压缩说明和重复情绪，保留回档规则、人物选择和章末钩子。",
        reviewIssues: sampleReviewIssues,
      });
    case "polish":
      return agent.polishStyle({
        ...baseInput,
        draft: sampleDraft,
        instruction: "降低 AI 味，增强具体动作和人物声音。",
        reviewIssues: sampleReviewIssues,
        styleGoal: "短段落、动作优先、克制但有压迫感。",
      });
  }
}

function defaultTargetWords(command: DemoCommand) {
  if (command === "compress") {
    return 1200;
  }
  if (command === "expand") {
    return 3200;
  }
  return 1800;
}

function createMockModel(command: DemoCommand): ChatModel {
  return {
    provider: "mock",
    model: "chapter-agent-demo",
    async complete(input: ChatCompletionInput): Promise<ChatCompletionOutput> {
      return {
        provider: "mock",
        model: "chapter-agent-demo",
        content: JSON.stringify(buildMockPayload(command, input)),
        usage: {
          promptTokens: input.messages.reduce((sum, message) => sum + message.content.length, 0),
          completionTokens: 120,
          totalTokens: input.messages.reduce((sum, message) => sum + message.content.length, 0) + 120,
        },
      };
    },
  };
}

function buildMockPayload(command: DemoCommand, input: ChatCompletionInput) {
  if (command === "plan") {
    return {
      viewpoint: "沈砚贴身视角",
      objective: "确认回档真实存在，并找到本轮第一处变量。",
      obstacle: "记忆缺口、灵力枯竭和门外杀手提前出现。",
      change: "沈砚从被动确认，转为主动布置一次反向试探。",
      sceneBeats: [
        {
          sceneNo: 1,
          purpose: "用具体异样证明回档不是梦",
          conflict: "身体疲惫和记忆缺口让判断不稳定",
          change: "沈砚找到旧玉佩上的新裂纹",
          keyCharacters: ["沈砚"],
        },
        {
          sceneNo: 2,
          purpose: "把杀手声音提前压到门外",
          conflict: "沈砚不能暴露自己知道上一轮真相",
          change: "他决定先装作未醒",
          keyCharacters: ["沈砚", "门外人"],
        },
      ],
      rewardMoment: "主角利用上一轮信息反制第一次试探。",
      endingHook: "门外响起上一轮杀死他的人的声音。",
      riskNotes: ["不要把回档源头提前说透。", "不要让灵力凭空恢复。"],
      warnings: [],
    };
  }

  const content = [
    "沈砚是在钟声里醒来的。",
    "",
    "不是梦里那种遥远的钟声，而是贴着耳膜炸开的，一下，又一下，像有人把冷铁钉进他的骨头。",
    "",
    "他睁开眼，先看见床帐边缘烧焦的一点黑痕。",
    "",
    "三日前。",
    "",
    "同一张床，同一道黑痕，同一口卡在喉咙里的血腥气。",
    "",
    "沈砚没有立刻坐起。他把右手压在被褥下，指尖一点点摸到腰侧。那里本该有一道被长刀贯穿的伤口，现在只剩下一片冰冷的汗。",
    "",
    "灵力仍是空的。",
    "",
    "这很好。至少规则没有突然变得慷慨。",
    "",
    "门外忽然传来脚步声。",
    "",
    "沈砚闭上眼。",
    "",
    "下一刻，那个在上一轮亲手杀死他的人，隔着门低声道：\"沈师弟，该醒了。\"",
  ].join("\n");

  if (command === "write") {
    return {
      title: "第三次醒来",
      content,
      summary: "沈砚第三次回到三日前，确认回档并听见上一轮杀死自己的人的声音。",
      warnings: [],
    };
  }

  return {
    title: "第三次醒来",
    content,
    summary: "沈砚醒来后确认回档，压低解释并用动作承接压力。",
    changedSummary: `Mock 已执行 ${command} 能力，保留回档规则和章末钩子。`,
    handledIssueIds: ["issue-dialogue-1", "issue-ai-voice-1"],
    unresolvedRisks: [],
    warnings: [],
  };
}

function printReadableResult(command: DemoCommand, result: Awaited<ReturnType<typeof runDemoCommand>>) {
  const output = result.output as unknown as Record<string, unknown>;
  console.log(`\n[chapter.${command}]`);
  console.log(`provider/model: ${String(output.provider)} / ${String(output.model)}`);
  console.log(`moduleChain: ${(output.moduleChain as string[] | undefined)?.join(" -> ") ?? "无"}`);
  console.log(`usedContextRefs: ${(output.usedContextRefs as unknown[] | undefined)?.length ?? 0}`);

  if (typeof output.wordCount === "number") {
    console.log(`wordCount: ${output.wordCount}`);
  }

  const warnings = output.warnings as string[] | undefined;
  if (warnings?.length) {
    console.log(`warnings: ${warnings.join("；")}`);
  }

  if (command === "plan") {
    console.log("\n写作计划：");
    console.log(`视角：${String(output.viewpoint)}`);
    console.log(`目标：${String(output.objective)}`);
    console.log(`阻碍：${String(output.obstacle)}`);
    console.log(`变化：${String(output.change)}`);
    console.log(`爽点：${String(output.rewardMoment)}`);
    console.log(`章末：${String(output.endingHook)}`);
    return;
  }

  if (typeof output.changedSummary === "string") {
    console.log(`changedSummary: ${output.changedSummary}`);
  }

  console.log("\n摘要：");
  console.log(String(output.summary ?? "无"));
  console.log("\n正文：");
  console.log(String(output.content ?? "无正文"));
}

const sampleNovel: ChapterNovelInput = {
  novelId: "novel-demo",
  title: "天命回档",
  genre: "玄幻悬疑",
  hook: "主角每次死亡都会回到三日前，但代价是失去一段记忆。",
  targetReaders: "喜欢升级、反转、悬疑感的男频读者",
  totalChapters: 120,
  currentVolume: "第一卷",
};

const sampleChapterPlan: ChapterPlanInput = {
  id: "chapter-plan-001",
  novelId: "novel-demo",
  chapterNo: 1,
  title: "第三次醒来",
  volumeTitle: "第一卷",
  objective: "主角意识到自己不是做梦，而是真的第三次回到同一天。",
  hook: "他在门外听见了上一次杀死自己的人的声音。",
  status: "已确认",
};

const sampleContext: ChapterContextPackage = {
  outlineSummary: "主角在连续死亡回档中寻找真相，并逐步发现宗门试炼背后的献祭阴谋。",
  volumeGoal: "第一卷让主角确认回档规则，找到第一个可信盟友，并揭开试炼异常。",
  previousChapterSummary: "",
  nextChapterObjective: "主角试探门外人，并确认对方也保留了部分上一轮痕迹。",
  nearbyChapterPlans: [
    {
      chapterNo: 2,
      title: "门外的人",
      objective: "主角在不暴露回档秘密的情况下试探杀手。",
      hook: "杀手说出一句只有上一轮才发生过的话。",
      status: "待写",
    },
  ],
  characterStates: [
    {
      id: "c-protagonist",
      name: "沈砚",
      currentGoal: "确认回档是否真实，并避免第三次死亡。",
      emotion: "警惕、疲惫、克制",
      relationship: "暂时无人可信",
      physicalState: "灵力枯竭，上一轮死亡痛感仍有残留",
      voice: "克制，少说废话，习惯先观察再下判断",
    },
  ],
  worldRules: ["回档不会恢复主角失去的记忆。", "灵力枯竭后短时间不能强行恢复。"],
  foreshadowing: [
    {
      id: "f-bell",
      title: "午夜钟声",
      status: "已埋设",
      summary: "每次死亡前都会听见同一声钟响。",
      payoffHint: "第一卷中段揭示钟声和试炼阵法有关。",
    },
  ],
  canonFacts: ["沈砚已经经历过两次死亡回档。", "上一轮杀死沈砚的人是同门师兄陆承。"],
  styleGuidance: ["短段落，动作优先。", "避免解释设定，优先让设定变成眼前麻烦。"],
  forbiddenExpressions: ["命运的齿轮开始转动", "一切都还没有结束"],
  contextRefs: [
    { id: "outline:demo", type: "outline", title: "演示总纲" },
    { id: "chapter-plan:001", type: "chapter", title: "第一章章纲" },
  ],
};

const sampleDraft = {
  draftId: "draft-demo-001",
  novelId: "novel-demo",
  chapterPlanId: "chapter-plan-001",
  chapterNo: 1,
  title: "第三次醒来",
  summary: "沈砚醒来后意识到自己再次回到三日前。",
  content: [
    "沈砚醒来后，意识到自己又回到了三日前。",
    "",
    "他开始回忆之前发生的一切，并发现这一次的情况和上一次不同。",
    "",
    "门外有人敲门。",
    "",
    "\"沈师弟，该醒了。\"",
  ].join("\n"),
};

const sampleReviewIssues = [
  {
    id: "issue-dialogue-1",
    severity: "warning" as const,
    category: "dialogue",
    description: "对白目前只承担提示作用，关系压力不足。",
    suggestion: "让门外人的台词带试探意味，让主角用沉默或动作回应。",
  },
  {
    id: "issue-ai-voice-1",
    severity: "warning" as const,
    category: "anti_ai_voice",
    description: "开头说明感偏强，缺少身体反应和具体物件。",
    suggestion: "用床帐黑痕、冷汗、灵力枯竭等具体细节替代总结。",
  },
];

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
