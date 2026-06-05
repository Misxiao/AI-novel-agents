import type { ChatMessage } from "../../../core/types.js";
import { buildChapterModulePromptLines } from "../../../webnovelSkill/runtime.js";
import type { ReviewChapterInput } from "../types.js";

const finalReviewChecks = [
  "剧情逻辑一致性：关键事件有没有前提，关键决定有没有触发，关键变化有没有后果。",
  "人物目标一致性：主角这章想做什么，过程中有没有无故漂移。",
  "情绪与关系一致性：情绪有没有来路，关系温度是否承接上一场。",
  "身体与信息状态一致性：伤势、疲劳、秘密、误会、已知信息有没有丢。",
  "场景与转场一致性：读者会不会迷路，上一场余力有没有带到下一场。",
  "章末承接一致性：章末有没有收在变化上，下一章第一拍能不能接住。",
  "去 AI 味：是否存在空泛总结、套话氛围、说明书对白和统一腔调。",
  "章纲覆盖：是否完成本章目标、阻碍、变化、爽点和章末钩子。",
  "字数治理：是否明显短章或偏离目标长度。",
];

export function buildReviewChapterMessages(input: ReviewChapterInput): ChatMessage[] {
  const targetWords = input.targetWords ?? 2500;
  const qualityThreshold = input.qualityThreshold ?? 85;

  return [
    {
      role: "system",
      content: [
        "你是本地中文网文创作平台内置的 review Agent。",
        "你的职责是评审章节正文草稿，输出结构化问题、责任模块和修订建议。",
        "你不直接修改正文，不写入 canon，不声明章节已确认。",
        "只输出 JSON 对象，不输出 Markdown，不输出解释。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "请评审当前章节草稿。",
        "",
        "## 小说基础",
        `novelId：${input.novel.novelId}`,
        `书名：${input.novel.title}`,
        `题材：${input.novel.genre}`,
        `核心钩子：${input.novel.hook}`,
        `目标读者：${input.novel.targetReaders}`,
        `当前分卷：${input.novel.currentVolume}`,
        "",
        "## 当前章纲",
        `章节：第 ${input.chapterPlan.chapterNo} 章`,
        `标题：${input.chapterPlan.title}`,
        `章节目标：${input.chapterPlan.objective}`,
        `章末拉力：${input.chapterPlan.hook}`,
        "",
        "## 写作执行计划",
        input.draftPlan
          ? [
              `视角：${input.draftPlan.viewpoint}`,
              `目标：${input.draftPlan.objective}`,
              `阻碍：${input.draftPlan.obstacle}`,
              `变化：${input.draftPlan.change}`,
              `爽点：${input.draftPlan.rewardMoment}`,
              `章末钩子：${input.draftPlan.endingHook}`,
            ].join("\n")
          : "暂缺，按章纲和正文实际效果评审。",
        "",
        "## 上下文约束",
        `上一章摘要：${input.context?.previousChapterSummary?.trim() || "暂缺"}`,
        `下一章目标：${input.context?.nextChapterObjective?.trim() || "暂缺"}`,
        `Canon 事实：${input.context?.canonFacts?.join("；") || "暂缺"}`,
        `禁用表达：${input.context?.forbiddenExpressions?.join("；") || "暂缺"}`,
        "",
        "## 当前草稿",
        `draftId：${input.draft.draftId}`,
        `标题：${input.draft.title}`,
        `摘要：${input.draft.summary?.trim() || "暂缺"}`,
        "正文：",
        input.draft.content,
        "",
        "## 评审门槛",
        `目标字数：约 ${targetWords} 个中文字符。`,
        `通过线：${qualityThreshold} 分。`,
        "只要存在 critical 问题，即使模型估分达到通过线，也必须判定 passed=false。",
        "",
        "## 内置中文网文模块链",
        ...buildChapterModulePromptLines(),
        "",
        "## 必查维度",
        ...finalReviewChecks.map((item) => `- ${item}`),
        "",
        "## 外部方法论内化规则",
        "可以吸收外部学习源的审计-修订-复审、章节目标-阻碍-变化、对白压力、章末拉力和去 AI 味等方法，但必须使用本项目原创表达，不复刻外部长文本、示例正文或大段 prompt。",
        "",
        "## 输出 JSON",
        "格式必须为：{\"passed\":false,\"overallScore\":0,\"summary\":\"评审摘要\",\"strengths\":[\"优点\"],\"issues\":[{\"id\":\"问题 id\",\"severity\":\"critical|warning|info\",\"category\":\"plot_logic|character_consistency|transition|dialogue|chapter_ending|anti_ai_voice|consistency_review|chapter_plan_coverage|word_count\",\"description\":\"问题描述\",\"suggestion\":\"修订建议\"}],\"moduleFindings\":[{\"moduleId\":\"模块 id\",\"status\":\"pass|warn|fail\",\"finding\":\"发现\"}],\"requiredRevisionInstruction\":\"给修订 Agent 的整合指令\",\"warnings\":[\"警告\"]}。",
      ].join("\n"),
    },
  ];
}
