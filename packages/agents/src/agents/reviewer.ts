import type {
  ChapterContextBundle,
  ChapterPlan,
  ConsistencyReport,
  DraftReview,
  Foundation,
  MainOutline,
  VolumeOutline,
} from "@ai-novel-agents/store";

import { defineCapability } from "../core/capability.js";
import { completeJson } from "../core/llmCalls.js";
import { renderChapterPlan, renderContextBundle } from "../core/render.js";

// ---------- 文学评审 ----------

const REVIEW_JSON_SHAPE = `{
  "score": 8.5,
  "verdict": "一句话总评",
  "dimensions": [
    { "name": "节奏与获得感", "score": 8, "comment": "..." },
    { "name": "钩子与追读拉力", "score": 9, "comment": "..." },
    { "name": "人物与对白", "score": 8, "comment": "..." },
    { "name": "文字质感（去AI腔）", "score": 7, "comment": "..." }
  ],
  "revisionInstructions": ["具体到可执行的修订指令；没有就返回空数组"]
}`;

const REVIEW_SYSTEM = [
  "你是挑剔的中文网文资深责编，按商业连载标准评审章节。",
  "评分标准（0-10）：9+ 可直接发表；8-9 小瑕疵；7-8 需要修订；7 以下结构性问题。",
  "四个维度：节奏与获得感（本章给了读者什么回报）、钩子与追读拉力（章末是否停在变化上）、人物与对白（行为是否有来路、对白是否做事）、文字质感（是否有 AI 腔、模板表达、均匀句式）。",
  "修订指令必须具体到位置和改法，不要「建议加强人物刻画」这种空话。",
  "只输出 JSON 对象，不输出解释。",
].join("\n");

export interface ReviewChapterInput {
  context: ChapterContextBundle;
  plan: ChapterPlan;
  draft: string;
}

export const reviewChapter = defineCapability<
  ReviewChapterInput,
  Omit<DraftReview, "consistency">
>({
  id: "reviewer.reviewChapter",
  agentId: "reviewer",
  summary: "按商业连载标准给章节打分并产出可执行修订指令",
  inputHint: "context：装配上下文；plan：章纲；draft：正文",
  tier: "review",
  async run(input, ctx) {
    return completeJson(ctx, this, [
      { role: "system", content: REVIEW_SYSTEM },
      {
        role: "user",
        content: [
          `请评审第 ${input.context.chapterNo} 章正文。`,
          "",
          ...renderChapterPlan(input.plan),
          "",
          "## 待评审正文",
          input.draft,
          "",
          "## 输出 JSON",
          REVIEW_JSON_SHAPE,
        ].join("\n"),
      },
    ]);
  },
});

// ---------- 六层一致性审查 ----------

const CONSISTENCY_JSON_SHAPE = `{
  "pass": true,
  "violations": [
    {
      "layer": "plot_logic | character_goal | emotion_relationship | body_knowledge | scene_transition | ending_hook",
      "severity": "blocker | warning",
      "detail": "具体违规：哪里、什么问题",
      "suggestion": "怎么改"
    }
  ]
}`;

const CONSISTENCY_SYSTEM = [
  "你是中文网文连载的一致性审查员，只查事实与逻辑连续性，不评文笔。",
  "六层审查清单：",
  "1. plot_logic 剧情逻辑：前提足不足、触发够不够、后果落不落地；伏笔指令是否执行（必须回收的是否真的回收了）",
  "2. character_goal 人物目标：本章目标清不清、过程有没有无故漂移",
  "3. emotion_relationship 情绪与关系：情绪有没有来路、关系温度对不对、有没有一键翻转",
  "4. body_knowledge 身体与知情：伤势/疲劳/持有物/位置是否连续；谁知道什么有没有错乱",
  "5. scene_transition 场景转场：读者会不会迷路、上一场的余力有没有被带过去",
  "6. ending_hook 章末承接：是否收在变化上、是否承接章纲钩子",
  "纪律：与上下文（人物状态轨迹、canon、伏笔轨迹）矛盾的判 blocker；存疑但文本未明确矛盾的判 warning。",
  "任何一条 blocker 都意味着 pass=false。没有违规返回空数组。",
  "只输出 JSON 对象，不输出解释。",
].join("\n");

export interface CheckConsistencyInput {
  context: ChapterContextBundle;
  plan: ChapterPlan;
  draft: string;
}

export const checkConsistency = defineCapability<CheckConsistencyInput, ConsistencyReport>({
  id: "reviewer.checkConsistency",
  agentId: "reviewer",
  summary: "六层一致性审查（确认门禁）：剧情逻辑/人物目标/情绪关系/身体知情/转场/章末承接",
  inputHint: "context：装配上下文；plan：章纲；draft：正文",
  tier: "review",
  async run(input, ctx) {
    // 不花 token 的确定性检查先行
    const localViolations = deterministicChecks(input);

    const llmReport = await completeJson<ConsistencyReport>(ctx, this, [
      { role: "system", content: CONSISTENCY_SYSTEM },
      {
        role: "user",
        content: [
          `请审查第 ${input.context.chapterNo} 章正文的一致性。`,
          "",
          ...renderContextBundle(input.context),
          "",
          ...renderChapterPlan(input.plan),
          "",
          "## 待审查正文",
          input.draft,
          "",
          "## 输出 JSON",
          CONSISTENCY_JSON_SHAPE,
        ].join("\n"),
      },
    ]);

    const violations = [...localViolations, ...llmReport.violations];
    return {
      pass: violations.every((violation) => violation.severity !== "blocker"),
      violations,
    };
  },
});

function deterministicChecks(input: CheckConsistencyInput): ConsistencyReport["violations"] {
  const violations: ConsistencyReport["violations"] = [];
  const wordCount = input.draft.replace(/\s/g, "").length;
  const target = input.plan.targetWords;

  if (wordCount < target * 0.6) {
    violations.push({
      layer: "plot_logic",
      severity: "blocker",
      detail: `正文 ${wordCount} 字，不足目标 ${target} 字的 60%，疑似截断或内容缺失`,
      suggestion: "补全场景或重新生成",
    });
  } else if (wordCount > target * 1.6) {
    violations.push({
      layer: "plot_logic",
      severity: "warning",
      detail: `正文 ${wordCount} 字，超出目标 ${target} 字的 160%`,
      suggestion: "压缩说明、重复情绪和过渡段",
    });
  }

  for (const expression of input.context.styleGuide?.forbiddenExpressions ?? []) {
    if (expression && input.draft.includes(expression)) {
      violations.push({
        layer: "plot_logic",
        severity: "warning",
        detail: `正文出现禁用表达：「${expression}」`,
        suggestion: "改写为具体的动作或细节",
      });
    }
  }

  return violations;
}

// ---------- 大纲评审 ----------

export interface ReviewOutlineInput {
  foundation: Foundation;
  scope: "main" | "volume";
  outline: MainOutline | VolumeOutline;
}

export interface OutlineReview {
  score: number;
  verdict: string;
  issues: string[];
  suggestions: string[];
}

export const reviewOutline = defineCapability<ReviewOutlineInput, OutlineReview>({
  id: "reviewer.reviewOutline",
  agentId: "reviewer",
  summary: "评审总纲/卷纲的结构质量：递进、伏笔分布、节拍密度",
  inputHint: "foundation：基础盘；scope：main|volume；outline：待评审纲",
  tier: "review",
  async run(input, ctx) {
    return completeJson<OutlineReview>(ctx, this, [
      {
        role: "system",
        content: [
          "你是中文网文结构编辑，评审大纲能否支撑稳定连载。",
          "检查点：冲突是否递进不发散、每卷有无独立闭环和兑现点、伏笔埋设与回收是否平衡、节拍有无空洞或堆叠、黄金三章是否成立（第一卷）。",
          "只输出 JSON 对象，不输出解释。",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `请评审以下${input.scope === "main" ? "总纲" : "卷纲"}。`,
          "",
          "## 基础盘",
          JSON.stringify(input.foundation, null, 2),
          "",
          "## 待评审纲",
          JSON.stringify(input.outline, null, 2),
          "",
          "## 输出 JSON",
          `{ "score": 8.5, "verdict": "一句话总评", "issues": ["发现的问题"], "suggestions": ["具体修改建议"] }`,
        ].join("\n"),
      },
    ]);
  },
});
