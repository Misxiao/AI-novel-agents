import type {
  ChapterContextPackage,
  ChapterPlanInput,
  ChapterNovelInput,
} from "../../agents/src/index.js";

export type DemoCommand =
  | "plan"
  | "write"
  | "revise"
  | "rewrite-scene"
  | "expand"
  | "compress"
  | "polish";

export interface CliOptions {
  command: DemoCommand;
  mock: boolean;
  mockContext: boolean;
  json: boolean;
  novelId?: string;
  novelTitle?: string;
  genre?: string;
  novelHook?: string;
  targetReaders?: string;
  totalChapters?: number;
  currentVolume?: string;
  chapterNo?: number;
  chapterTitle?: string;
  volumeTitle?: string;
  chapterObjective?: string;
  chapterHook?: string;
  intent?: string;
  targetWords?: number;
  outlineSummary?: string;
  volumeGoal?: string;
  previousSummary?: string;
  nextObjective?: string;
  canonFacts: string[];
  worldRules: string[];
  styleGuidance: string[];
  forbiddenExpressions: string[];
  ragSnippets: string[];
}

export const DEFAULT_COMMAND: DemoCommand = "write";
export const DEFAULT_MOCK_CONTEXT_NOVEL_ID = "novel-cli-mock";

export function parseArgs(args: string[]): CliOptions {
  const command = args.find((arg): arg is DemoCommand => isDemoCommand(arg)) ?? DEFAULT_COMMAND;
  const chapterNoArg = readStringFlag(args, "--chapter-no");
  const targetWordsArg = readStringFlag(args, "--target-words");
  const totalChaptersArg = readStringFlag(args, "--total-chapters");
  const chapterNo = chapterNoArg ? Number(chapterNoArg) : undefined;
  const targetWords = targetWordsArg ? Number(targetWordsArg) : undefined;
  const totalChapters = totalChaptersArg ? Number(totalChaptersArg) : undefined;

  return {
    command,
    mock: args.includes("--mock"),
    mockContext: args.includes("--mock-context"),
    json: args.includes("--json"),
    novelId: readStringFlag(args, "--novel-id"),
    novelTitle: readStringFlag(args, "--novel-title"),
    genre: readStringFlag(args, "--genre"),
    novelHook: readStringFlag(args, "--novel-hook"),
    targetReaders: readStringFlag(args, "--target-readers"),
    totalChapters: Number.isFinite(totalChapters) ? totalChapters : undefined,
    currentVolume: readStringFlag(args, "--current-volume"),
    chapterNo: Number.isFinite(chapterNo) ? chapterNo : undefined,
    chapterTitle: readStringFlag(args, "--chapter-title"),
    volumeTitle: readStringFlag(args, "--volume-title"),
    chapterObjective: readStringFlag(args, "--chapter-objective"),
    chapterHook: readStringFlag(args, "--chapter-hook"),
    intent: readStringFlag(args, "--intent"),
    targetWords: Number.isFinite(targetWords) ? targetWords : undefined,
    outlineSummary: readStringFlag(args, "--outline-summary"),
    volumeGoal: readStringFlag(args, "--volume-goal"),
    previousSummary: readStringFlag(args, "--previous-summary"),
    nextObjective: readStringFlag(args, "--next-objective"),
    canonFacts: readStringFlags(args, "--canon-fact"),
    worldRules: readStringFlags(args, "--world-rule"),
    styleGuidance: readStringFlags(args, "--style-guidance"),
    forbiddenExpressions: readStringFlags(args, "--forbidden-expression"),
    ragSnippets: readStringFlags(args, "--rag-snippet"),
  };
}

export function createMockContextRepository(options: CliOptions) {
  return {
    assembleChapterProductionContext(input: {
      novelId: string;
      chapterNo?: number;
      authorIntent?: string;
    }) {
      const novelId = options.novelId ?? input.novelId ?? DEFAULT_MOCK_CONTEXT_NOVEL_ID;
      const chapterNo = options.chapterNo ?? input.chapterNo ?? 1;
      const novel = buildNovel(options, novelId);
      const chapterPlan = buildChapterPlan(options, novelId, chapterNo);
      const context = buildContext(options, input.authorIntent);
      const sourceRefs = [
        { id: "mock-context:cli", type: "rag" as const, title: "CLI mock 前置条件" },
        { id: `chapter-plan:${chapterPlan.id}`, type: "chapter" as const, title: chapterPlan.title },
      ];

      return {
        novel,
        chapterNo,
        chapterPlan,
        chapterPlans: [chapterPlan],
        nearbyChapterPlans: [],
        context: {
          ...context,
          contextRefs: sourceRefs,
        },
        missingAssets: [],
        sourceRefs,
      };
    },
  };
}

function buildNovel(options: CliOptions, novelId: string): ChapterNovelInput {
  return {
    novelId,
    title: options.novelTitle ?? "天命回档",
    genre: options.genre ?? "玄幻悬疑",
    hook: options.novelHook ?? "主角每次死亡都会回到三日前，但代价是失去一段记忆。",
    targetReaders: options.targetReaders ?? "喜欢升级、反转、悬疑感的男频读者",
    totalChapters: options.totalChapters ?? 120,
    currentVolume: options.currentVolume ?? "第一卷",
  };
}

function buildChapterPlan(
  options: CliOptions,
  novelId: string,
  chapterNo: number,
): ChapterPlanInput {
  return {
    id: `mock-chapter-plan-${chapterNo}`,
    novelId,
    chapterNo,
    title: options.chapterTitle ?? "第三次醒来",
    volumeTitle: options.volumeTitle ?? options.currentVolume ?? "第一卷",
    objective: options.chapterObjective ?? "主角确认回档真实存在，并找到本轮第一处变量。",
    hook: options.chapterHook ?? "门外人说出只有上一轮死亡前才出现过的称呼。",
    status: "已确认",
  };
}

function buildContext(options: CliOptions, authorIntent?: string): ChapterContextPackage {
  const ragSnippets = [
    ...(authorIntent?.trim() ? [`作者本章想法：${authorIntent.trim()}`] : []),
    ...options.ragSnippets,
  ];

  return {
    outlineSummary: options.outlineSummary ?? "主角在长期危机中寻找真相，每章都要让局面发生具体变化。",
    volumeGoal: options.volumeGoal ?? "第一卷建立核心规则、可信盟友和第一处强反转。",
    previousChapterSummary: options.previousSummary ?? "",
    nextChapterObjective: options.nextObjective,
    canonFacts: options.canonFacts.length > 0
      ? options.canonFacts
      : ["主角已经经历过两次失败尝试。"],
    worldRules: options.worldRules.length > 0
      ? options.worldRules
      : ["核心超自然规则不能无代价解决眼前危机。"],
    styleGuidance: options.styleGuidance.length > 0
      ? options.styleGuidance
      : ["短段落，动作优先。", "避免解释设定，优先让设定变成眼前麻烦。"],
    forbiddenExpressions: options.forbiddenExpressions.length > 0
      ? options.forbiddenExpressions
      : ["命运的齿轮开始转动", "一切都还没有结束"],
    ragSnippets,
  };
}

function readStringFlag(args: string[], flag: string) {
  const prefix = `${flag}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function readStringFlags(args: string[], flag: string) {
  const prefix = `${flag}=`;
  return args
    .filter((arg) => arg.startsWith(prefix))
    .map((arg) => arg.slice(prefix.length).trim())
    .filter(Boolean);
}

function isDemoCommand(value: string): value is DemoCommand {
  return ["plan", "write", "revise", "rewrite-scene", "expand", "compress", "polish"].includes(value);
}
