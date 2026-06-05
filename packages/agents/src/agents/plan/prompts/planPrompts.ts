import type { ChatMessage } from "../../../core/types.js";
import { buildChapterModulePromptLines } from "../../../webnovelSkill/runtime.js";
import type { ChapterContextPackage } from "../../chapter/types.js";
import type { CreateChapterDraftPlanInput, CreateChapterPlanInput } from "../types.js";

const chapterModulePromptLines = buildChapterModulePromptLines();

export function buildCreateChapterPlanMessages(input: CreateChapterPlanInput): ChatMessage[] {
  return buildPlanMessages({
    systemTask: "你的职责是根据小说资产和作者想法生成单章章纲草案。",
    userLines: [
      "请生成当前章节的章纲草案。",
      "",
      ...renderNovel(input.novel),
      `目标章节：第 ${input.chapterNo} 章`,
      `作者本章想法：${input.authorIntent?.trim() || "无额外作者想法，请承接总纲、卷目标和近邻章纲。"}`,
      ...renderContext(input.context),
      "",
      "## 章纲要求",
      "章纲只回答这一章写什么，不写正文。",
      "必须包含标题、所属分卷、本章目标、章末拉力。",
      "本章目标要能直接指导正文生产，不能写成抽象口号。",
      "章末拉力必须能承接到下一章或当前卷目标。",
      "",
      "## 输出 JSON",
      "格式必须为：{\"title\":\"章节标题\",\"volumeTitle\":\"所属分卷\",\"objective\":\"本章目标\",\"hook\":\"章末拉力\",\"status\":\"草稿\",\"warnings\":[\"风险提示\"]}。",
    ],
  });
}

export function buildCreateChapterDraftPlanMessages(input: CreateChapterDraftPlanInput): ChatMessage[] {
  const targetWords = input.targetWords ?? 2500;

  return buildPlanMessages({
    systemTask: "你的职责是为当前章节生成写作前执行计划。",
    userLines: [
      "请生成本章写作执行计划。",
      "",
      ...renderNovel(input.novel),
      "",
      "## 当前章纲",
      `章节：第 ${input.chapterPlan.chapterNo} 章`,
      `标题：${input.chapterPlan.title}`,
      `所属分卷：${input.chapterPlan.volumeTitle}`,
      `章节目标：${input.chapterPlan.objective}`,
      `章末拉力：${input.chapterPlan.hook}`,
      `作者本章想法：${input.authorIntent?.trim() || "无额外作者想法，请严格承接章纲。"}`,
      ...renderContext(input.context),
      "",
      "## 计划要求",
      `目标正文长度：约 ${targetWords} 个中文字符。`,
      "必须明确：视角、目标、阻碍、局面变化、场景节拍、预期爽点、章末钩子和设定风险。",
      "不要生成正文。",
      "",
      "## 输出 JSON",
      "格式必须为：{\"viewpoint\":\"视角\",\"objective\":\"本章目标\",\"obstacle\":\"核心阻碍\",\"change\":\"章末局面变化\",\"sceneBeats\":[{\"sceneNo\":1,\"purpose\":\"场景目的\",\"conflict\":\"冲突\",\"change\":\"变化\",\"keyCharacters\":[\"角色\"]}],\"rewardMoment\":\"预期爽点\",\"endingHook\":\"章末钩子\",\"riskNotes\":[\"风险\"],\"warnings\":[\"警告\"]}。",
    ],
  });
}

function buildPlanMessages(params: { systemTask: string; userLines: string[] }): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是本地中文网文创作平台内置的 PlanAgent。",
        params.systemTask,
        "你只负责章节结构规划和写作执行计划，不生成正文，不写入 canon，不更新记忆。",
        "只输出 JSON 对象，不输出 Markdown，不输出解释。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        ...params.userLines,
        "",
        "## 内置中文网文模块链",
        ...chapterModulePromptLines,
        "结构问题优先于文风问题，不能用润色掩盖因果和人物问题。",
      ].join("\n"),
    },
  ];
}

function renderNovel(novel: CreateChapterPlanInput["novel"]) {
  return [
    "## 小说基础",
    `novelId：${novel.novelId}`,
    `书名：${novel.title}`,
    `题材：${novel.genre}`,
    `核心钩子：${novel.hook}`,
    `目标读者：${novel.targetReaders}`,
    `当前分卷：${novel.currentVolume}`,
    `计划总章数：${novel.totalChapters}`,
  ];
}

function renderContext(context?: ChapterContextPackage) {
  return [
    "",
    "## 可用上下文",
    `总纲摘要：${context?.outlineSummary?.trim() || "暂缺。"}`,
    `分卷目标：${context?.volumeGoal?.trim() || "暂缺。"}`,
    `上一章摘要：${context?.previousChapterSummary?.trim() || "暂缺。"}`,
    `下一章目标：${context?.nextChapterObjective?.trim() || "暂缺。"}`,
    ...renderList("近邻章纲", context?.nearbyChapterPlans?.map((item) => `第 ${item.chapterNo} 章《${item.title}》：${item.objective}${item.hook ? `；钩子：${item.hook}` : ""}`)),
    ...renderList("世界观硬规则", context?.worldRules),
    ...renderList("Canon 事实", context?.canonFacts),
    ...renderList("伏笔状态", context?.foreshadowing?.map((item) => `${item.title}（${item.status}）：${item.summary}${item.payoffHint ? `；兑现提示：${item.payoffHint}` : ""}`)),
    ...renderList("作者与检索片段", context?.ragSnippets),
    ...renderList("风格约束", context?.styleGuidance),
  ];
}

function renderList(title: string, items?: string[]) {
  const normalized = (items ?? []).map((item) => item.trim()).filter(Boolean);
  if (normalized.length === 0) {
    return [`${title}：暂缺`];
  }

  return [`${title}：`, ...normalized.map((item) => `- ${item}`)];
}

