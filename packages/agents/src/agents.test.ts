import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  ChapterContextBundle,
  ChapterPlan,
  Foundation,
  Setting,
} from "@ai-novel-agents/store";

import type { AgentContext, AgentUsageReport } from "./core/capability.js";
import * as inspiration from "./agents/inspiration.js";
import * as setting from "./agents/setting.js";
import * as outline from "./agents/outline.js";
import * as plan from "./agents/plan.js";
import * as writer from "./agents/writer.js";
import * as reviewer from "./agents/reviewer.js";
import * as memoryAgent from "./agents/memory.js";
import { capabilities, getCapability, listCapabilities } from "./registry.js";
import { searchExemplars, listExemplarTags } from "./retrieval/searchExemplars.js";
import { createScriptedModel } from "./testing/mockModel.js";

const FOUNDATION: Foundation = {
  title: "噬星者",
  genre: "星际玄幻",
  logline: "废土少年吞噬星核觉醒",
  hook: "吞噬体系",
  mainConflict: "人类与噬星文明的存亡战",
  storyEngine: "星核吞噬升级",
  protagonist: { name: "林尘", identity: "拾荒少年", want: "找到失踪的姐姐", flaw: "不信任何人" },
  targetReaders: "男频",
  tone: "热血",
};

const SETTING: Setting = {
  worldRules: ["星核不可再生", "吞噬有反噬"],
  locations: [{ name: "废星城", description: "开局贫民窟" }],
  characters: [
    {
      name: "林尘",
      role: "protagonist",
      profile: { identity: "拾荒少年", personality: "谨慎", background: "孤儿", want: "找姐姐" },
    },
  ],
  styleGuide: { voice: "第三人称限知", pacing: "快", forbiddenExpressions: ["命运的齿轮"] },
};

const PLAN: ChapterPlan = {
  title: "第一颗星核",
  objective: "林尘捡到星核并觉醒",
  viewpoint: "林尘",
  scenes: [
    { purpose: "拾荒遇险", conflict: "巡逻队追捕", outcome: "躲进废墟", characters: ["林尘"] },
    { purpose: "觉醒", conflict: "星核反噬", outcome: "吞噬成功", characters: ["林尘"] },
  ],
  foreshadowActions: [{ foreshadowId: "fs_1", action: "plant", how: "星核里浮现姐姐的影像" }],
  expectedCharacterChanges: [{ name: "林尘", change: "觉醒吞噬能力" }],
  endingHook: "影像中的姐姐睁开了眼",
  targetWords: 100,
};

function bundle(): ChapterContextBundle {
  return {
    novel: {
      id: "novel_1",
      title: "噬星者",
      status: "writing",
      createdAt: "",
      updatedAt: "",
    },
    chapterNo: 1,
    volumeNo: 1,
    chapterPlan: PLAN,
    foreshadowDirectives: [],
    activeCharacters: [],
    foundation: FOUNDATION,
    styleGuide: SETTING.styleGuide,
    worldRules: SETTING.worldRules,
    recentChapterSummaries: [],
    volumeSummaries: [],
    canonFacts: [],
  };
}

function contextWith(model: ReturnType<typeof createScriptedModel>): AgentContext & {
  usageReports: AgentUsageReport[];
  deltas: string[];
} {
  const usageReports: AgentUsageReport[] = [];
  const deltas: string[] = [];
  return {
    model: () => model,
    onDelta: (text) => deltas.push(text),
    onUsage: (report) => usageReports.push(report),
    usageReports,
    deltas,
  };
}

test("注册表：18 个能力可枚举可查找", () => {
  assert.equal(capabilities.length, 18);
  assert.ok(getCapability("writer.writeChapter"));
  assert.equal(getCapability("不存在"), undefined);
  const listed = listCapabilities();
  assert.equal(listed.length, 18);
  assert.ok(listed.every((item) => item.summary && item.inputHint));
});

test("generateFoundation 解析 JSON 并上报用量", async () => {
  const model = createScriptedModel([JSON.stringify(FOUNDATION)]);
  const ctx = contextWith(model);
  const result = await inspiration.generateFoundation.run(
    { ideas: "废土少年吞噬星核" },
    ctx,
  );
  assert.equal(result.title, "噬星者");
  assert.equal(ctx.usageReports.length, 1);
  assert.equal(ctx.usageReports[0].capabilityId, "inspiration.generateFoundation");
  assert.equal(model.calls[0].responseFormat, "json_object");
});

test("reviseFoundation 拆出 revisionNote", async () => {
  const model = createScriptedModel([
    JSON.stringify({ ...FOUNDATION, hook: "新卖点", revisionNote: "改了卖点" }),
  ]);
  const result = await inspiration.reviseFoundation.run(
    { current: FOUNDATION, instruction: "卖点改一下" },
    contextWith(model),
  );
  assert.equal(result.content.hook, "新卖点");
  assert.equal(result.revisionNote, "改了卖点");
  assert.ok(!("revisionNote" in result.content));
});

test("generateSetting 与 reviseSetting", async () => {
  const generated = await setting.generateSetting.run(
    { foundation: FOUNDATION },
    contextWith(createScriptedModel([JSON.stringify(SETTING)])),
  );
  assert.equal(generated.characters[0].name, "林尘");

  const revised = await setting.reviseSetting.run(
    { foundation: FOUNDATION, current: SETTING, instruction: "加一个反派" },
    contextWith(
      createScriptedModel([JSON.stringify({ ...SETTING, revisionNote: "加了反派" })]),
    ),
  );
  assert.equal(revised.revisionNote, "加了反派");
});

test("generateVolumeOutline 提示词包含伏笔台账与起始章号", async () => {
  const mainOutline = {
    premise: "前提",
    protagonistArc: "弧线",
    volumes: [
      { volumeNo: 1, title: "卷一", goal: "活下来", mainConflict: "围剿", climax: "突围", estimatedChapters: 30 },
    ],
    foreshadowSeeds: [],
    ending: "结局",
  };
  const volumeOutline = {
    volumeNo: 1,
    title: "卷一",
    goal: "活下来",
    chapterRange: { from: 1, to: 30 },
    beats: [{ chapters: "1-3", summary: "黄金三章" }],
    foreshadowPlan: [],
    endingHook: "钩子",
  };
  const model = createScriptedModel([JSON.stringify(volumeOutline)]);
  const result = await outline.generateVolumeOutline.run(
    {
      foundation: FOUNDATION,
      mainOutline,
      volumeNo: 1,
      startChapterNo: 1,
      openForeshadows: [
        {
          id: "fs_1",
          novelId: "novel_1",
          title: "姐姐的下落",
          description: "失踪之谜",
          importance: "core",
          status: "planted",
          source: "outline",
          plantedChapterNo: 1,
          createdAt: "",
          updatedAt: "",
        },
      ],
    },
    contextWith(model),
  );
  assert.equal(result.chapterRange.to, 30);
  const prompt = model.calls[0].messages[1].content;
  assert.ok(prompt.includes("姐姐的下落"));
  assert.ok(prompt.includes("起始章号为第 1 章"));
});

test("planChapter 渲染上下文包", async () => {
  const model = createScriptedModel([JSON.stringify(PLAN)]);
  const result = await plan.planChapter.run(
    { context: bundle(), authorIntent: "这章要爽" },
    contextWith(model),
  );
  assert.equal(result.title, "第一颗星核");
  const prompt = model.calls[0].messages[1].content;
  assert.ok(prompt.includes("《噬星者》"));
  assert.ok(prompt.includes("世界观硬规则"));
  assert.ok(prompt.includes("这章要爽"));
});

test("writeChapter 流式输出纯正文并透出增量", async () => {
  const prose = "废星城的酸雨下了三天。\n\n林尘把最后一块合金板拖进废墟。";
  const model = createScriptedModel([prose]);
  const ctx = contextWith(model);
  const result = await writer.writeChapter.run(
    {
      context: bundle(),
      plan: PLAN,
      exemplars: searchExemplars({ type: "开头钩子", limit: 1 }),
    },
    ctx,
  );
  assert.equal(result.content, prose);
  assert.equal(ctx.deltas.join(""), prose);
  // 正文走纯文本，不是 JSON mode
  assert.notEqual(model.calls[0].responseFormat, "json_object");
  const prompt = model.calls[0].messages[1].content;
  assert.ok(prompt.includes("本章章纲"));
  assert.ok(prompt.includes("写作技法"));
});

test("reviseChapter 携带修订指令", async () => {
  const model = createScriptedModel(["修订后的正文"]);
  const result = await writer.reviseChapter.run(
    { context: bundle(), plan: PLAN, draft: "旧正文", directives: ["开头太慢，直接进冲突"] },
    contextWith(model),
  );
  assert.equal(result.content, "修订后的正文");
  assert.ok(model.calls[0].messages[1].content.includes("开头太慢"));
});

test("reviewChapter 返回评分与修订指令", async () => {
  const review = {
    score: 7.5,
    verdict: "节奏可以，钩子弱",
    dimensions: [{ name: "钩子与追读拉力", score: 6, comment: "章末平" }],
    revisionInstructions: ["章末改为停在姐姐影像睁眼瞬间"],
  };
  const result = await reviewer.reviewChapter.run(
    { context: bundle(), plan: PLAN, draft: "正文" },
    contextWith(createScriptedModel([JSON.stringify(review)])),
  );
  assert.equal(result.score, 7.5);
  assert.equal(result.revisionInstructions.length, 1);
});

test("checkConsistency 合并确定性检查与模型审查", async () => {
  const llmReport = { pass: true, violations: [] };
  // 正文只有几个字 → 字数确定性检查应产生 blocker
  const result = await reviewer.checkConsistency.run(
    { context: bundle(), plan: PLAN, draft: "太短", },
    contextWith(createScriptedModel([JSON.stringify(llmReport)])),
  );
  assert.equal(result.pass, false);
  assert.ok(result.violations.some((violation) => violation.detail.includes("60%")));

  // 字数达标 + 禁用表达 → warning 不阻塞
  const okDraft = "正文内容。".repeat(25) + "命运的齿轮。";
  const result2 = await reviewer.checkConsistency.run(
    { context: bundle(), plan: PLAN, draft: okDraft },
    contextWith(createScriptedModel([JSON.stringify(llmReport)])),
  );
  assert.equal(result2.pass, true);
  assert.ok(result2.violations.some((violation) => violation.detail.includes("禁用表达")));
});

test("extractChapterMemory 返回结构化记忆", async () => {
  const memory = {
    summary: "林尘觉醒",
    characterStates: [{ name: "林尘", goal: "找姐姐", changeNote: "觉醒吞噬能力" }],
    foreshadowEvents: [],
    newForeshadows: [
      { title: "姐姐的影像", description: "星核中的影像", importance: "core", expectedResolveFrom: 20 },
    ],
    canonFacts: [{ category: "character", subject: "林尘", fact: "拥有吞噬能力" }],
  };
  const result = await memoryAgent.extractChapterMemory.run(
    { context: bundle(), chapterNo: 1, content: "正文" },
    contextWith(createScriptedModel([JSON.stringify(memory)])),
  );
  assert.equal(result.newForeshadows[0].importance, "core");
});

test("语料检索：标签交集排序与类型过滤", () => {
  const tags = listExemplarTags();
  assert.ok(tags.length > 5);

  const byType = searchExemplars({ type: "开头钩子", limit: 3 });
  assert.equal(byType.length, 3);
  assert.ok(byType.every((exemplar) => exemplar.type === "开头钩子"));

  const byTags = searchExemplars({ type: "结尾余韵", tags: ["危机压身"], limit: 2 });
  assert.ok(byTags.every((exemplar) => exemplar.tags.includes("危机压身")));
});

test("completeJson 对脏 JSON 抛出可读错误", async () => {
  const model = createScriptedModel(["这不是 JSON"]);
  await assert.rejects(
    inspiration.generateFoundation.run({ ideas: "x" }, contextWith(model)),
    /无法解析的 JSON/,
  );
});
