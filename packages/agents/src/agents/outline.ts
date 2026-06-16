import type {
  Foreshadow,
  Foundation,
  MainOutline,
  Setting,
  VolumeOutline,
} from "@ai-novel-agents/store";

import { defineCapability } from "../core/capability.js";
import { completeJson } from "../core/llmCalls.js";

const MAIN_OUTLINE_JSON_SHAPE = `{
  "premise": "全书故事概述（200 字内）",
  "protagonistArc": "主角从开局到结局的成长弧线",
  "volumes": [
    {
      "volumeNo": 1,
      "title": "卷名",
      "goal": "本卷主角要达成什么",
      "mainConflict": "本卷主冲突",
      "climax": "卷末高潮与兑现点（必须回收或推进至少一条伏笔）",
      "estimatedChapters": 30
    }
  ],
  "foreshadowSeeds": [
    {
      "title": "伏笔名",
      "description": "伏笔内容与最终兑现方式",
      "importance": "core | major | minor",
      "plantVolumeNo": 1,
      "resolveVolumeNo": 3
    }
  ],
  "ending": "结局走向"
}`;

const VOLUME_OUTLINE_JSON_SHAPE = `{
  "volumeNo": 1,
  "title": "卷名",
  "goal": "本卷目标",
  "chapterRange": { "from": 1, "to": 30 },
  "beats": [
    { "chapters": "1-3", "summary": "黄金三章：建立处境、引爆冲突、给出转折" },
    { "chapters": "4-7", "summary": "这一拍发生什么、局面如何变化" }
  ],
  "foreshadowPlan": [
    { "foreshadowTitle": "伏笔名", "action": "plant | advance | resolve", "aroundChapter": 12 }
  ],
  "endingHook": "卷末钩子：读者为什么要追下一卷"
}`;

const SYSTEM = [
  "你是资深中文网文大纲架构师，擅长设计能稳定连载数百章的结构。",
  "结构原则：每卷有独立的目标-冲突-高潮闭环，同时为主线蓄力；卷末必须有兑现点和新钩子。",
  "伏笔原则：core 伏笔贯穿全书，major 跨卷，minor 卷内闭环；每卷至少回收一条、新埋一条。",
  "节拍原则：第一卷前三章必须完成「建立、冲突、转折」黄金三章；每拍 3-5 章，拍与拍之间压力递进。",
  "只输出 JSON 对象，不输出解释。",
].join("\n");

export interface GenerateMainOutlineInput {
  foundation: Foundation;
  setting: Setting;
  volumeCount: number;
  chaptersPerVolume?: number;
}

export const generateMainOutline = defineCapability<GenerateMainOutlineInput, MainOutline>({
  id: "outline.generateMainOutline",
  agentId: "outline",
  summary: "生成总纲：卷划分、主角弧线、主线伏笔种子",
  inputHint: "foundation/setting：前置资产；volumeCount：计划卷数",
  tier: "plan",
  async run(input, ctx) {
    return completeJson<MainOutline>(ctx, this, [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          `请生成 ${input.volumeCount} 卷的总纲，每卷约 ${input.chaptersPerVolume ?? 30} 章。`,
          "",
          "## 基础盘",
          JSON.stringify(input.foundation, null, 2),
          "",
          "## 设定",
          JSON.stringify(input.setting, null, 2),
          "",
          "## 要求",
          "- 每卷的 goal 必须是主角的具体行动目标，不是抽象主题",
          "- foreshadowSeeds 给 3-6 条，至少 1 条 core",
          "- 卷与卷之间冲突规模递进，避免中段发散",
          "",
          "## 输出 JSON",
          MAIN_OUTLINE_JSON_SHAPE,
        ].join("\n"),
      },
    ]);
  },
});

export interface GenerateVolumeOutlineInput {
  foundation: Foundation;
  mainOutline: MainOutline;
  volumeNo: number;
  startChapterNo: number;
  /** 前一卷摘要（第 2 卷起提供） */
  previousVolumeSummary?: string;
  /** 当前未回收的伏笔，卷纲需要安排其中到期者 */
  openForeshadows: Foreshadow[];
  /** 作者对本卷的想法（可选，优先满足） */
  authorNotes?: string;
}

export const generateVolumeOutline = defineCapability<GenerateVolumeOutlineInput, VolumeOutline>({
  id: "outline.generateVolumeOutline",
  agentId: "outline",
  summary: "生成单卷卷纲：章节节拍与本卷伏笔计划",
  inputHint: "mainOutline：总纲；volumeNo：卷号；openForeshadows：未回收伏笔",
  tier: "plan",
  async run(input, ctx) {
    const volumePlan = input.mainOutline.volumes.find((v) => v.volumeNo === input.volumeNo);
    return completeJson<VolumeOutline>(ctx, this, [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          `请为第 ${input.volumeNo} 卷生成卷纲，起始章号为第 ${input.startChapterNo} 章。`,
          "",
          "## 基础盘",
          JSON.stringify(input.foundation, null, 2),
          "",
          "## 总纲",
          JSON.stringify(input.mainOutline, null, 2),
          ...(volumePlan
            ? ["", "## 本卷在总纲中的规划", JSON.stringify(volumePlan, null, 2)]
            : []),
          ...(input.previousVolumeSummary
            ? ["", "## 前一卷实际发生了什么", input.previousVolumeSummary]
            : []),
          ...(input.authorNotes?.trim()
            ? ["", "## 作者想法（优先满足）", input.authorNotes.trim()]
            : []),
          "",
          "## 当前未回收的伏笔台账",
          input.openForeshadows.length > 0
            ? input.openForeshadows
                .map(
                  (fs) =>
                    `- ${fs.title}（${fs.importance}，第 ${fs.plantedChapterNo} 章埋设${fs.expectedResolveFrom ? `，预期第 ${fs.expectedResolveFrom}-${fs.expectedResolveTo ?? "?"} 章回收` : ""}）：${fs.description}`,
                )
                .join("\n")
            : "（暂无）",
          "",
          "## 要求",
          `- chapterRange.from 必须是 ${input.startChapterNo}，章数与总纲规划一致`,
          "- 回收窗口落在本卷的伏笔必须安排 resolve；总纲计划本卷埋设的伏笔安排 plant",
          "- beats 覆盖全部章节区间，无空洞无重叠，每拍说明局面变化",
          ...(input.volumeNo === 1 ? ["- 第一拍必须是黄金三章"] : []),
          "",
          "## 输出 JSON",
          VOLUME_OUTLINE_JSON_SHAPE,
        ].join("\n"),
      },
    ]);
  },
});

export interface ReviseOutlineInput {
  scope: "main" | "volume";
  current: MainOutline | VolumeOutline;
  instruction: string;
  foundation: Foundation;
  /** scope=volume 时：已确认到第几章，之前的节拍不可改动 */
  confirmedUpToChapter?: number;
}

export interface RevisedOutline {
  content: MainOutline | VolumeOutline;
  revisionNote: string;
}

export const reviseOutline = defineCapability<ReviseOutlineInput, RevisedOutline>({
  id: "outline.reviseOutline",
  agentId: "outline",
  summary: "按用户指令修改总纲或卷纲，已确认章节对应的部分不可改动",
  inputHint: "scope：main|volume；current：当前纲；instruction：修改指令",
  tier: "plan",
  async run(input, ctx) {
    const shape = input.scope === "main" ? MAIN_OUTLINE_JSON_SHAPE : VOLUME_OUTLINE_JSON_SHAPE;
    const result = await completeJson<(MainOutline | VolumeOutline) & { revisionNote: string }>(
      ctx,
      this,
      [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            `请按修改指令调整${input.scope === "main" ? "总纲" : "卷纲"}。`,
            "",
            "## 基础盘",
            JSON.stringify(input.foundation, null, 2),
            "",
            "## 当前纲",
            JSON.stringify(input.current, null, 2),
            "",
            "## 修改指令",
            input.instruction,
            "",
            "## 要求",
            "- 只修改指令涉及的部分，未提及的内容原样保留",
            ...(input.confirmedUpToChapter
              ? [
                  `- 第 ${input.confirmedUpToChapter} 章及之前的内容已经确认发表，对应节拍/规划严禁改动，只能调整之后的部分`,
                ]
              : []),
            "- 如果修改导致前后矛盾，允许联动调整并在 revisionNote 说明",
            "",
            "## 输出 JSON",
            `在纲 JSON 的基础上增加一个字段："revisionNote": "本次改了什么、为什么"`,
            shape,
          ].join("\n"),
        },
      ],
    );
    const { revisionNote, ...content } = result;
    return { content: content as MainOutline | VolumeOutline, revisionNote };
  },
});
