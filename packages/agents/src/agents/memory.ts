import type { ChapterContextBundle, ChapterMemory } from "@ai-novel-agents/store";

import { defineCapability } from "../core/capability.js";
import { completeJson } from "../core/llmCalls.js";
import { renderContextBundle } from "../core/render.js";

const MEMORY_JSON_SHAPE = `{
  "summary": "本章摘要（150 字内：发生了什么、局面变成了什么、章末钩子是什么）",
  "characterStates": [
    {
      "name": "角色名",
      "goal": "本章结束时的目标",
      "emotion": "情绪状态",
      "relationships": "对关键角色的态度（如：对林尘由警惕转为暗中支持）",
      "physical": "身体/位置/持有物",
      "knowledge": "知道了什么新信息、还不知道什么",
      "changeNote": "本章该角色发生的关键变化（一句话）"
    }
  ],
  "foreshadowEvents": [
    { "foreshadowId": "上下文台账中给出的 id", "event": "advanced | resolved", "note": "正文中如何推进/回收的" }
  ],
  "newForeshadows": [
    {
      "title": "新伏笔名",
      "description": "伏笔内容与预期兑现方式",
      "importance": "core | major | minor",
      "expectedResolveFrom": 15,
      "expectedResolveTo": 25
    }
  ],
  "canonFacts": [
    { "category": "world | character | item | rule | event", "subject": "主语（人名/地名/物名）", "fact": "一句话事实" }
  ]
}`;

const SYSTEM = [
  "你是中文网文连载的档案管理员，从确认发表的章节正文中提取结构化记忆。",
  "铁律：只记录正文文本明确支持的事实，宁缺勿滥。推测、暗示、可能性一律不记。",
  "characterStates：只记录本章状态发生变化的角色；没变化的角色不要出现。",
  "foreshadowEvents：只有正文实际推进或回收了台账中的伏笔才记录；foreshadowId 必须来自上下文中的伏笔台账。",
  "newForeshadows：只记录正文明显新埋设、且后文需要兑现的悬念；日常小钩子不算。",
  "canonFacts：只记录后文必须遵守的硬事实（能力数值、身世揭示、地理关系、规则确立等）。",
  "只输出 JSON 对象，不输出解释。",
].join("\n");

export interface ExtractChapterMemoryInput {
  context: ChapterContextBundle;
  chapterNo: number;
  content: string;
}

export const extractChapterMemory = defineCapability<ExtractChapterMemoryInput, ChapterMemory>({
  id: "memory.extractChapterMemory",
  agentId: "memory",
  summary: "从确认正文中提取人物状态变化、伏笔进展、新伏笔、canon 事实和章摘要",
  inputHint: "context：装配上下文（含伏笔台账与人物状态）；content：确认正文",
  tier: "review",
  async run(input, ctx) {
    return completeJson<ChapterMemory>(ctx, this, [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          `请从第 ${input.chapterNo} 章正文中提取记忆。`,
          "",
          ...renderContextBundle(input.context),
          "",
          "## 确认正文",
          input.content,
          "",
          "## 输出 JSON",
          MEMORY_JSON_SHAPE,
        ].join("\n"),
      },
    ]);
  },
});

export interface SummarizeVolumeInput {
  volumeNo: number;
  volumeTitle?: string;
  chapterSummaries: Array<{ chapterNo: number; content: string }>;
}

export const summarizeVolume = defineCapability<SummarizeVolumeInput, { content: string }>({
  id: "memory.summarizeVolume",
  agentId: "memory",
  summary: "把整卷的章摘要压缩为卷摘要",
  inputHint: "volumeNo：卷号；chapterSummaries：该卷全部章摘要",
  tier: "review",
  async run(input, ctx) {
    return completeJson<{ content: string }>(ctx, this, [
      {
        role: "system",
        content: [
          "你是中文网文档案管理员，负责把一卷的章摘要压缩成卷摘要。",
          "卷摘要 400 字内：本卷主线推进、关键人物变化、回收与新埋的伏笔、卷末局面。",
          "只保留对后续剧情有影响的信息。",
          `只输出 JSON：{ "content": "卷摘要" }`,
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `请为第 ${input.volumeNo} 卷${input.volumeTitle ? `《${input.volumeTitle}》` : ""}生成卷摘要。`,
          "",
          "## 章摘要",
          ...input.chapterSummaries.map((s) => `第 ${s.chapterNo} 章：${s.content}`),
        ].join("\n"),
      },
    ]);
  },
});

export interface UpdateGlobalRecapInput {
  previousRecap?: string;
  /** 上次提要覆盖点之后的新增章摘要 */
  newChapterSummaries: Array<{ chapterNo: number; content: string }>;
  coversToChapter: number;
}

export const updateGlobalRecap = defineCapability<UpdateGlobalRecapInput, { content: string }>({
  id: "memory.updateGlobalRecap",
  agentId: "memory",
  summary: "增量更新全局前情提要",
  inputHint: "previousRecap：旧提要；newChapterSummaries：新增章摘要",
  tier: "review",
  async run(input, ctx) {
    return completeJson<{ content: string }>(ctx, this, [
      {
        role: "system",
        content: [
          "你是中文网文档案管理员，负责维护全局前情提要。",
          "前情提要 600 字内：开局处境、主线进展的关键节点、当前局面、主要人物关系现状。",
          "旧提要中已经不影响当前剧情的细节可以压缩或删除；新增内容按重要性融入。",
          `只输出 JSON：{ "content": "前情提要" }`,
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `请更新全局前情提要，更新后覆盖到第 ${input.coversToChapter} 章。`,
          "",
          "## 旧提要",
          input.previousRecap ?? "（首次生成，无旧提要）",
          "",
          "## 新增章摘要",
          ...input.newChapterSummaries.map((s) => `第 ${s.chapterNo} 章：${s.content}`),
        ].join("\n"),
      },
    ]);
  },
});
