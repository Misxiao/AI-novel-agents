import type { ChapterContextBundle, ChapterPlan } from "@ai-novel-agents/store";

import { defineCapability } from "../core/capability.js";
import { streamText } from "../core/llmCalls.js";
import { renderChapterPlan, renderContextBundle, renderList } from "../core/render.js";
import { buildChapterTechniquePromptLines } from "../resources/writingTechniques.js";
import type { Exemplar } from "../retrieval/searchExemplars.js";

const SYSTEM = [
  "你是签约多年的中文网文大神作者，文字有画面感、节奏感和人物声音。",
  "你直接输出小说正文，不输出标题行、章节号、解释、注释或任何 markdown 标记。",
  "正文纪律：",
  "- 伏笔指令是硬约束：标记「必须回收」的伏笔必须在本章正文中完成回收，「应当推进」的必须有实质推进",
  "- 人物行为必须承接其状态轨迹；身体状态（伤势/疲劳/持有物）和知情状态（谁知道什么）不得凭空改变",
  "- 既成事实（canon）和世界观硬规则不得违背",
  "- 对白必须改变信息、关系或局面之一；不同角色的语言习惯要有区别",
  "- 段落长短错落，适配移动端阅读",
].join("\n");

const techniqueLines = buildChapterTechniquePromptLines();

function renderExemplars(exemplars: Exemplar[]): string[] {
  if (exemplars.length === 0) {
    return [];
  }
  return [
    "",
    "## 参考范文片段（学习其结构与张力，严禁照抄内容和设定）",
    ...exemplars.flatMap((exemplar, index) => [
      `### 范文 ${index + 1}（${exemplar.type}）`,
      exemplar.text,
    ]),
  ];
}

export interface WriteChapterInput {
  context: ChapterContextBundle;
  plan: ChapterPlan;
  exemplars?: Exemplar[];
}

export const writeChapter = defineCapability<WriteChapterInput, { content: string }>({
  id: "writer.writeChapter",
  agentId: "writer",
  summary: "按章纲和上下文流式生成章节正文",
  inputHint: "context：装配上下文；plan：章纲；exemplars：可选范文片段",
  tier: "prose",
  async run(input, ctx) {
    const content = await streamText(
      ctx,
      this,
      [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            `请写出第 ${input.context.chapterNo} 章的完整正文。`,
            "",
            ...renderContextBundle(input.context),
            "",
            ...renderChapterPlan(input.plan),
            ...renderExemplars(input.exemplars ?? []),
            "",
            "## 写作技法（执行清单）",
            ...techniqueLines,
            "",
            `## 输出要求`,
            `直接输出正文，约 ${input.plan.targetWords} 字，允许上下浮动 20%。不要标题，不要任何正文以外的内容。`,
          ].join("\n"),
        },
      ],
      { temperature: 0.8 },
    );
    return { content: content.trim() };
  },
});

export interface ReviseChapterInput {
  context: ChapterContextBundle;
  plan: ChapterPlan;
  draft: string;
  /** 修订指令：评审意见、一致性违规或用户要求，逐条列出 */
  directives: string[];
}

export const reviseChapter = defineCapability<ReviseChapterInput, { content: string }>({
  id: "writer.reviseChapter",
  agentId: "writer",
  summary: "按修订指令重写章节正文（整章修订/重写场景/扩写/压缩均通过指令表达）",
  inputHint: "draft：当前正文；directives：修订指令列表",
  tier: "prose",
  async run(input, ctx) {
    const content = await streamText(
      ctx,
      this,
      [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            `请按修订指令重写第 ${input.context.chapterNo} 章正文，输出修订后的完整正文。`,
            "",
            ...renderContextBundle(input.context),
            "",
            ...renderChapterPlan(input.plan),
            "",
            "## 当前正文",
            input.draft,
            "",
            ...renderList("## 修订指令（必须逐条处理）", input.directives),
            "",
            "## 输出要求",
            "只修改与指令相关的内容，其余部分保持稳定（剧情事实、人物状态、专有名词不得漂移）。",
            "直接输出修订后的完整正文，不要标题，不要修改说明。",
          ].join("\n"),
        },
      ],
      { temperature: 0.6 },
    );
    return { content: content.trim() };
  },
});

export interface PolishChapterInput {
  context: ChapterContextBundle;
  draft: string;
  styleGoal?: string;
}

export const polishChapter = defineCapability<PolishChapterInput, { content: string }>({
  id: "writer.polishChapter",
  agentId: "writer",
  summary: "去 AI 腔润色：不改剧情，只提升文字质感",
  inputHint: "draft：当前正文；styleGoal：可选风格目标",
  tier: "prose",
  async run(input, ctx) {
    const content = await streamText(
      ctx,
      this,
      [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            "请对以下正文做去 AI 腔润色。",
            "",
            `风格目标：${input.styleGoal?.trim() || "减少模板化表达和均匀工整的句式；情绪落到动作、沉默、退让或反击上，不直接总结情绪。"}`,
            ...(input.context.styleGuide
              ? renderList("禁用表达", input.context.styleGuide.forbiddenExpressions)
              : []),
            "",
            "## 当前正文",
            input.draft,
            "",
            "## 输出要求",
            "严禁改变剧情因果、人物行为、对白信息量、设定事实和章末钩子。",
            "直接输出润色后的完整正文，不要标题，不要说明。",
          ].join("\n"),
        },
      ],
      { temperature: 0.5 },
    );
    return { content: content.trim() };
  },
});
