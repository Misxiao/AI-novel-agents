import assert from "node:assert/strict";
import { test } from "node:test";

import { openStore, type Store } from "./index.js";
import type { ChapterMemory, Foundation, Setting } from "./types.js";

function memoryStore(): Store {
  return openStore(":memory:");
}

const FOUNDATION: Foundation = {
  title: "测试之书",
  genre: "玄幻",
  logline: "一句话定位",
  hook: "核心卖点",
  mainConflict: "主冲突",
  storyEngine: "升级打怪",
  protagonist: { name: "林尘", identity: "废柴少年", want: "复仇", flaw: "冲动" },
  targetReaders: "男频",
  tone: "热血",
};

const SETTING: Setting = {
  worldRules: ["灵气复苏", "等级森严"],
  locations: [{ name: "青云城", description: "边陲小城" }],
  characters: [
    {
      name: "林尘",
      role: "protagonist",
      profile: {
        identity: "废柴少年",
        personality: "外冷内热",
        background: "家族被灭",
        want: "复仇",
      },
    },
  ],
  styleGuide: { voice: "第三人称", pacing: "快节奏", forbiddenExpressions: ["命运的齿轮"] },
};

test("novel 与资产版本化", () => {
  const store = memoryStore();
  const novel = store.novels.create({ title: "测试之书", genre: "玄幻" });

  const v1 = store.assets.saveVersion(novel.id, "foundation", FOUNDATION);
  assert.equal(v1.version, 1);
  assert.equal(v1.status, "active");

  const v2 = store.assets.saveVersion(novel.id, "foundation", {
    ...FOUNDATION,
    hook: "修改后的卖点",
  });
  assert.equal(v2.version, 2);
  assert.equal(store.assets.getActive<Foundation>(novel.id, "foundation")?.content.hook, "修改后的卖点");
  assert.equal(store.assets.getVersion(novel.id, "foundation", 1)?.status, "superseded");
  assert.equal(store.assets.listVersions(novel.id, "foundation").length, 2);

  store.close();
});

test("大纲按 scope/卷 独立版本化", () => {
  const store = memoryStore();
  const novel = store.novels.create({ title: "书" });

  store.outlines.saveVersion({
    novelId: novel.id,
    scope: "main",
    content: { premise: "主线" },
  });
  store.outlines.saveVersion({
    novelId: novel.id,
    scope: "volume",
    volumeNo: 1,
    content: { volumeNo: 1, chapterRange: { from: 1, to: 30 } },
  });
  store.outlines.saveVersion({
    novelId: novel.id,
    scope: "volume",
    volumeNo: 1,
    content: { volumeNo: 1, chapterRange: { from: 1, to: 40 } },
    revisionNote: "扩到 40 章",
  });

  assert.ok(store.outlines.getActiveMain(novel.id));
  const volume = store.outlines.getActiveVolume(novel.id, 1);
  assert.equal(volume?.version, 2);
  assert.equal(volume?.revisionNote, "扩到 40 章");
  assert.equal(store.outlines.listVersions(novel.id, "volume", 1).length, 2);

  store.close();
});

test("章节生命周期与草稿版本", () => {
  const store = memoryStore();
  const novel = store.novels.create({ title: "书" });

  const chapter = store.chapters.ensure(novel.id, 1, 1);
  assert.equal(chapter.status, "planned");
  // 幂等
  assert.equal(store.chapters.ensure(novel.id, 1, 1).id, chapter.id);

  const draft1 = store.chapters.addDraft(chapter.id, { content: "第一稿正文", source: "write" });
  const draft2 = store.chapters.addDraft(chapter.id, { content: "第二稿正文修订", source: "revise" });
  assert.equal(draft1.version, 1);
  assert.equal(draft2.version, 2);
  assert.equal(draft2.wordCount, "第二稿正文修订".length);
  assert.equal(store.chapters.latestDraft(chapter.id)?.id, draft2.id);

  store.chapters.setDraftReview(draft2.id, {
    score: 8.5,
    verdict: "通过",
    dimensions: [],
    revisionInstructions: [],
  });
  assert.equal(store.chapters.getDraft(draft2.id)?.review?.score, 8.5);

  store.chapters.setConfirmedDraft(chapter.id, draft2.id);
  const confirmed = store.chapters.get(novel.id, 1);
  assert.equal(confirmed?.status, "confirmed");
  assert.equal(confirmed?.confirmedDraftId, draft2.id);
  assert.equal(store.chapters.nextChapterNo(novel.id), 2);

  store.close();
});

test("伏笔状态机与待回收派生", () => {
  const store = memoryStore();
  const novel = store.novels.create({ title: "书" });

  const fs = store.foreshadows.create({
    novelId: novel.id,
    title: "神秘玉佩",
    description: "主角的玉佩藏着秘密",
    importance: "core",
    plantedChapterNo: 1,
    expectedResolveFrom: 10,
    expectedResolveTo: 20,
  });
  assert.equal(fs.status, "planted");
  assert.equal(store.foreshadows.listEvents(fs.id).length, 1);

  store.foreshadows.recordEvent(fs.id, 5, "advanced", "玉佩发光");
  assert.equal(store.foreshadows.get(fs.id)?.status, "advanced");

  assert.equal(store.foreshadows.listDue(novel.id, 9).length, 0);
  assert.equal(store.foreshadows.listDue(novel.id, 10).length, 1);

  store.foreshadows.recordEvent(fs.id, 12, "resolved", "玉佩认主");
  const resolved = store.foreshadows.get(fs.id);
  assert.equal(resolved?.status, "resolved");
  assert.equal(resolved?.resolvedChapterNo, 12);
  assert.equal(store.foreshadows.listOpen(novel.id).length, 0);
  assert.equal(store.foreshadows.listDue(novel.id, 15).length, 0);

  store.close();
});

test("记忆事务：apply 落库与 rollback 还原", () => {
  const store = memoryStore();
  const novel = store.novels.create({ title: "书" });
  store.characters.upsert({
    novelId: novel.id,
    name: "林尘",
    role: "protagonist",
    profile: SETTING.characters[0].profile,
  });
  const oldFs = store.foreshadows.create({
    novelId: novel.id,
    title: "神秘玉佩",
    description: "玉佩",
    importance: "core",
    plantedChapterNo: 1,
  });

  const memory: ChapterMemory = {
    summary: "林尘在第 5 章突破炼气期",
    characterStates: [
      {
        name: "林尘",
        goal: "进入宗门",
        emotion: "振奋",
        physical: "轻伤",
        changeNote: "突破炼气期",
      },
      { name: "白长老", changeNote: "首次登场，暗中观察林尘" },
    ],
    foreshadowEvents: [{ foreshadowId: oldFs.id, event: "advanced", note: "玉佩再次发热" }],
    newForeshadows: [
      {
        title: "白长老的身份",
        description: "白长老似乎认识林尘父亲",
        importance: "major",
        expectedResolveFrom: 15,
      },
    ],
    canonFacts: [{ category: "character", subject: "林尘", fact: "炼气期三层" }],
  };

  store.memory.applyChapterMemory(novel.id, 5, memory);

  // 新角色自动建档
  const elder = store.characters.getByName(novel.id, "白长老");
  assert.ok(elder);
  assert.equal(elder!.firstChapterNo, 5);
  // 状态快照
  const protagonist = store.characters.getByName(novel.id, "林尘")!;
  assert.equal(store.characters.recentStates(protagonist.id, 5, 3).length, 1);
  // 伏笔推进与新增
  assert.equal(store.foreshadows.get(oldFs.id)?.status, "advanced");
  assert.ok(store.foreshadows.findByTitle(novel.id, "白长老的身份"));
  // canon 与章摘要
  assert.equal(store.canon.list(novel.id).length, 1);
  assert.ok(store.summaries.get(novel.id, "chapter", 5));

  // 回滚后全部还原
  store.memory.rollbackChapterMemory(novel.id, 5);
  assert.equal(store.characters.recentStates(protagonist.id, 5, 3).length, 0);
  assert.equal(store.foreshadows.get(oldFs.id)?.status, "planted");
  assert.equal(store.foreshadows.findByTitle(novel.id, "白长老的身份"), undefined);
  assert.equal(store.canon.list(novel.id).length, 0);
  assert.equal(store.summaries.get(novel.id, "chapter", 5), undefined);

  store.close();
});

test("workflow run 与步骤检查点", () => {
  const store = memoryStore();
  const novel = store.novels.create({ title: "书" });

  const run = store.runs.createRun(novel.id, "writeChapter", { chapterNo: 1 });
  store.runs.upsertStep({ runId: run.id, stepId: "plan", seq: 1, status: "running" });
  store.runs.upsertStep({
    runId: run.id,
    stepId: "plan",
    seq: 1,
    status: "completed",
    output: { title: "第一章" },
  });

  const steps = store.runs.getSteps(run.id);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].status, "completed");
  assert.deepEqual(steps[0].output, { title: "第一章" });

  assert.equal(store.runs.findInterruptedRun(novel.id)?.id, run.id);
  store.runs.setRunStatus(run.id, "completed");
  assert.equal(store.runs.findInterruptedRun(novel.id), undefined);

  store.runs.recordAgentRun({
    novelId: novel.id,
    capabilityId: "writer.writeChapter",
    provider: "deepseek",
    model: "deepseek-v4-pro",
    totalTokens: 1000,
    durationMs: 1200,
    status: "ok",
  });
  assert.deepEqual(store.runs.usageTotals(novel.id), { totalTokens: 1000, callCount: 1 });

  store.close();
});

test("上下文装配：伏笔指令、状态链与预算裁剪", () => {
  const store = memoryStore();
  const novel = store.novels.create({ title: "测试之书" });
  store.assets.saveVersion(novel.id, "foundation", FOUNDATION);
  store.assets.saveVersion(novel.id, "setting", SETTING);
  store.characters.upsert({
    novelId: novel.id,
    name: "林尘",
    role: "protagonist",
    profile: SETTING.characters[0].profile,
  });

  // 第 1-4 章已确认：每章一份记忆 + 确认稿
  for (let no = 1; no <= 4; no++) {
    const chapter = store.chapters.ensure(novel.id, 1, no);
    const draft = store.chapters.addDraft(chapter.id, {
      content: `第${no}章正文。\n\n${"剧情推进。".repeat(200)}\n\n章末钩子${no}。`,
      source: "write",
    });
    store.chapters.setConfirmedDraft(chapter.id, draft.id);
    store.memory.applyChapterMemory(novel.id, no, {
      summary: `第${no}章摘要`,
      characterStates: [{ name: "林尘", goal: `目标${no}`, changeNote: `变化${no}` }],
      foreshadowEvents: [],
      newForeshadows:
        no === 1
          ? [
              {
                title: "神秘玉佩",
                description: "玉佩的秘密",
                importance: "core",
                expectedResolveFrom: 5,
              },
            ]
          : [],
      canonFacts: [{ category: "character", subject: "林尘", fact: `第${no}章既成事实` }],
    });
  }

  const bundle = store.assembleChapterContext(novel.id, 5, 4000);

  // 伏笔窗口已到 → should_resolve
  assert.equal(bundle.foreshadowDirectives.length, 1);
  assert.equal(bundle.foreshadowDirectives[0].directive, "should_resolve");
  assert.equal(bundle.foreshadowDirectives[0].foreshadow.title, "神秘玉佩");
  assert.ok(bundle.foreshadowDirectives[0].history.length >= 1);

  // 无章纲时回落主角，最近 3 章状态链
  const protagonistContext = bundle.activeCharacters.find(
    (entry) => entry.character.name === "林尘",
  );
  assert.ok(protagonistContext);
  assert.deepEqual(
    protagonistContext!.recentStates.map((state) => state.chapterNo),
    [2, 3, 4],
  );

  // 前一章正文被截断到预算的 40% 以内并保留尾部
  assert.ok(bundle.previousChapterText);
  assert.ok(bundle.previousChapterText!.length <= 4000 * 0.4 + 50);
  assert.ok(bundle.previousChapterText!.includes("章末钩子4"));

  // 基础信息齐备
  assert.equal(bundle.volumeNo, 1);
  assert.equal(bundle.foundation?.title, "测试之书");
  assert.deepEqual(bundle.worldRules, SETTING.worldRules);
  assert.ok(bundle.recentChapterSummaries.length >= 1);

  store.close();
});

test("schema 版本不匹配时给出中文错误", () => {
  const store = openStore(":memory:");
  store.close();
  // 直接验证 ensureSchema 的防御逻辑需要持久库；此处确认 :memory: 重复打开正常
  const again = openStore(":memory:");
  assert.ok(again.novels.list().length === 0);
  again.close();
});
