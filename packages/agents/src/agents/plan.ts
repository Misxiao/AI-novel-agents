import type { ChapterContextBundle, ChapterPlan } from "@ai-novel-agents/store";

import { defineCapability } from "../core/capability.js";
import { completeJson } from "../core/llmCalls.js";
import { renderChapterPlan, renderContextBundle } from "../core/render.js";

const PLAN_JSON_SHAPE = `{
  "title": "章节标题（吸引点击，不剧透关键反转）",
  "objective": "本章目标：主角要完成/遭遇什么",
  "viewpoint": "视角（通常跟随主角）",
  "scenes": [
    {
      "purpose": "场景目的",
      "conflict": "场景内冲突或压力",
      "outcome": "场景结果（局面变化）",
      "characters": ["出场角色名"]
    }
  ],
  "foreshadowActions": [
    { "foreshadowId": "伏笔指令中给出的 id", "action": "plant | advance | resolve", "how": "在哪个场景、用什么方式" }
  ],
  "expectedCharacterChanges": [
    { "name": "角色名", "change": "本章结束时该角色的状态变化" }
  ],
  "endingHook": "章末钩子",
  "targetWords": 2500
}`;

const SYSTEM = [
  "你是资深中文网文主编，负责把卷纲拆解成可直接执行的单章章纲。",
  "章纲原则：每章必须有目标、阻碍、变化；2-4 个场景；章末停在问题、威胁、揭示或反转上。",
  "伏笔纪律：上下文中标记「必须回收」的伏笔必须在本章安排 resolve 动作；标记「应当推进」的安排 advance。",
  "人物纪律：场景中的角色行为必须承接其最近状态，不得凭空翻转。",
  "只输出 JSON 对象，不输出解释。",
].join("\n");

export interface PlanChapterInput {
  context: ChapterContextBundle;
  /** 作者对本章的意图（可选） */
  authorIntent?: string;
  targetWords?: number;
}

export const planChapter = defineCapability<PlanChapterInput, ChapterPlan>({
  id: "plan.planChapter",
  agentId: "plan",
  summary: "基于装配上下文生成单章章纲（场景序列/伏笔动作/预期人物变化/章末钩子）",
  inputHint: "context：装配好的章节上下文；authorIntent：可选作者意图",
  tier: "plan",
  async run(input, ctx) {
    return completeJson<ChapterPlan>(ctx, this, [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          `请为第 ${input.context.chapterNo} 章生成章纲。`,
          "",
          ...renderContextBundle(input.context),
          ...(input.authorIntent ? ["", "## 作者意图（优先满足）", input.authorIntent] : []),
          "",
          "## 要求",
          `- targetWords 设为 ${input.targetWords ?? 2500}`,
          "- 本章剧情必须落在卷纲对应节拍的范围内",
          "- foreshadowActions 只能引用伏笔指令中出现的 id；没有指令就返回空数组",
          "",
          "## 输出 JSON",
          PLAN_JSON_SHAPE,
        ].join("\n"),
      },
    ]);
  },
});

export interface ReviseChapterPlanInput {
  context: ChapterContextBundle;
  current: ChapterPlan;
  instruction: string;
}

export const reviseChapterPlan = defineCapability<ReviseChapterPlanInput, ChapterPlan>({
  id: "plan.reviseChapterPlan",
  agentId: "plan",
  summary: "按用户指令修改既有章纲",
  inputHint: "context：装配上下文；current：当前章纲；instruction：修改指令",
  tier: "plan",
  async run(input, ctx) {
    return completeJson<ChapterPlan>(ctx, this, [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          `请按修改指令调整第 ${input.context.chapterNo} 章的章纲。`,
          "",
          ...renderContextBundle(input.context),
          "",
          ...renderChapterPlan(input.current),
          "",
          "## 修改指令",
          input.instruction,
          "",
          "## 要求",
          "- 只修改指令涉及的部分，未提及的内容原样保留",
          "- 伏笔指令的约束依然有效，不得因修改而丢掉必须回收的伏笔",
          "",
          "## 输出 JSON",
          PLAN_JSON_SHAPE,
        ].join("\n"),
      },
    ]);
  },
});
