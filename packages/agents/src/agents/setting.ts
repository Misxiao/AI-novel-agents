import type { Foundation, Setting } from "@ai-novel-agents/store";

import { defineCapability } from "../core/capability.js";
import { completeJson } from "../core/llmCalls.js";

const SETTING_JSON_SHAPE = `{
  "worldRules": ["世界观硬规则，每条一句话，必须可被剧情验证"],
  "powerSystem": "力量/晋升体系（如题材不需要可省略）",
  "locations": [{ "name": "地点名", "description": "一句话描述与剧情功能" }],
  "characters": [
    {
      "name": "角色名",
      "role": "protagonist | major | minor",
      "profile": {
        "identity": "身份",
        "appearance": "外貌特征（可选）",
        "personality": "性格底色",
        "background": "出身与经历",
        "want": "长线欲望",
        "voice": "说话方式与口癖"
      }
    }
  ],
  "styleGuide": {
    "voice": "叙事视角（如：第三人称限知，跟随主角）",
    "pacing": "节奏要求",
    "forbiddenExpressions": ["禁用的模板化表达"]
  }
}`;

const SYSTEM = [
  "你是资深中文网文世界观架构师，擅长设计为剧情服务的设定。",
  "原则：设定冰山法——只设计会被剧情用到的部分；每条世界规则都要能制造冲突或限制主角。",
  "角色设计原则：每个主要角色的欲望必须与主角的欲望相交（合作、竞争或冲突）。",
  "只输出 JSON 对象，不输出解释。",
].join("\n");

export interface GenerateSettingInput {
  foundation: Foundation;
  extraNotes?: string;
}

export const generateSetting = defineCapability<GenerateSettingInput, Setting>({
  id: "setting.generateSetting",
  agentId: "setting",
  summary: "基于基础盘生成世界观、初始角色表与文风约束",
  inputHint: "foundation：基础盘；extraNotes：可选补充要求",
  tier: "plan",
  async run(input, ctx) {
    return completeJson<Setting>(ctx, this, [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          "请基于小说基础盘生成设定。",
          "",
          "## 基础盘",
          JSON.stringify(input.foundation, null, 2),
          ...(input.extraNotes ? ["", "## 补充要求", input.extraNotes] : []),
          "",
          "## 要求",
          "- 世界规则 4-8 条，每条都要能在剧情里制造压力",
          "- 角色 4-8 个：1 个主角 + 2-4 个主要角色 + 若干次要角色",
          "- forbiddenExpressions 给出 4-6 个该题材最常见的 AI 腔表达",
          "- 主角档案必须与基础盘中的主角设定一致",
          "",
          "## 输出 JSON",
          SETTING_JSON_SHAPE,
        ].join("\n"),
      },
    ]);
  },
});

export interface ReviseSettingInput {
  foundation: Foundation;
  current: Setting;
  instruction: string;
}

export interface RevisedSetting {
  content: Setting;
  revisionNote: string;
}

export const reviseSetting = defineCapability<ReviseSettingInput, RevisedSetting>({
  id: "setting.reviseSetting",
  agentId: "setting",
  summary: "按用户指令修改设定，未提及的部分保持不变",
  inputHint: "foundation：基础盘；current：当前设定；instruction：修改指令",
  tier: "plan",
  async run(input, ctx) {
    const result = await completeJson<Setting & { revisionNote: string }>(ctx, this, [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          "请按修改指令调整小说设定。",
          "",
          "## 基础盘",
          JSON.stringify(input.foundation, null, 2),
          "",
          "## 当前设定",
          JSON.stringify(input.current, null, 2),
          "",
          "## 修改指令",
          input.instruction,
          "",
          "## 要求",
          "- 只修改指令涉及的部分，未提及的内容原样保留（包括角色列表的顺序）",
          "- 如果修改牵连其他设定的一致性，允许联动调整并在 revisionNote 说明",
          "",
          "## 输出 JSON",
          `在设定 JSON 的基础上增加一个字段："revisionNote": "本次改了什么、为什么"`,
          SETTING_JSON_SHAPE,
        ].join("\n"),
      },
    ]);
    const { revisionNote, ...content } = result;
    return { content, revisionNote };
  },
});
