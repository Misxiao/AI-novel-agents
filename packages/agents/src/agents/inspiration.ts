import type { Foundation } from "@ai-novel-agents/store";

import { defineCapability } from "../core/capability.js";
import { completeJson } from "../core/llmCalls.js";

const FOUNDATION_JSON_SHAPE = `{
  "title": "书名",
  "genre": "题材（如：都市修真/星际机甲/古言宅斗）",
  "logline": "一句话定位（谁+在什么处境+要做什么+最大的看点）",
  "hook": "核心卖点：读者为什么非看这本不可",
  "mainConflict": "贯穿全书的主冲突",
  "storyEngine": "故事引擎：能持续产生新剧情的机制（升级体系/任务循环/身份悬疑等）",
  "protagonist": { "name": "主角名", "identity": "开场身份", "want": "最强烈的欲望", "flaw": "致命弱点" },
  "targetReaders": "目标读者画像",
  "tone": "基调（热血/轻松/暗黑/甜宠等）"
}`;

const SYSTEM = [
  "你是资深中文网文策划编辑，擅长把模糊的灵感打磨成有商业潜力的小说基础盘。",
  "评估标准：题材消费点是否明确、hook 是否前置、故事引擎能否支撑长篇、主角欲望是否强烈。",
  "只输出 JSON 对象，不输出解释。",
].join("\n");

export interface GenerateFoundationInput {
  /** 用户的灵感、点子、想法，自由文本 */
  ideas: string;
  genrePreference?: string;
}

export const generateFoundation = defineCapability<GenerateFoundationInput, Foundation>({
  id: "inspiration.generateFoundation",
  agentId: "inspiration",
  summary: "把用户灵感打磨成小说基础盘（定位/卖点/主冲突/故事引擎/主角雏形）",
  inputHint: "ideas：灵感自由文本；genrePreference：可选题材偏好",
  tier: "plan",
  async run(input, ctx) {
    return completeJson<Foundation>(ctx, this, [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          "请基于以下灵感生成小说基础盘。",
          "",
          "## 灵感",
          input.ideas,
          ...(input.genrePreference ? ["", `题材偏好：${input.genrePreference}`] : []),
          "",
          "## 要求",
          "- 卖点必须具体到能写进章节，不要空泛的「爽」「逆袭」",
          "- 故事引擎必须能推导出至少三卷的剧情来源",
          "- 主角的欲望和弱点要能互相制造麻烦",
          "",
          "## 输出 JSON",
          FOUNDATION_JSON_SHAPE,
        ].join("\n"),
      },
    ]);
  },
});

export interface ReviseFoundationInput {
  current: Foundation;
  instruction: string;
}

export interface RevisedFoundation {
  content: Foundation;
  revisionNote: string;
}

export const reviseFoundation = defineCapability<ReviseFoundationInput, RevisedFoundation>({
  id: "inspiration.reviseFoundation",
  agentId: "inspiration",
  summary: "按用户指令修改基础盘，未提及的部分保持不变",
  inputHint: "current：当前基础盘；instruction：修改指令",
  tier: "plan",
  async run(input, ctx) {
    const result = await completeJson<Foundation & { revisionNote: string }>(ctx, this, [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          "请按修改指令调整小说基础盘。",
          "",
          "## 当前基础盘",
          JSON.stringify(input.current, null, 2),
          "",
          "## 修改指令",
          input.instruction,
          "",
          "## 要求",
          "- 只修改指令涉及的部分，未提及的字段原样保留",
          "- 如果修改牵连其他字段的一致性（如换题材影响卖点），允许联动调整并在 revisionNote 说明",
          "",
          "## 输出 JSON",
          `在基础盘 JSON 的基础上增加一个字段："revisionNote": "本次改了什么、为什么"`,
          FOUNDATION_JSON_SHAPE,
        ].join("\n"),
      },
    ]);
    const { revisionNote, ...content } = result;
    return { content, revisionNote };
  },
});
