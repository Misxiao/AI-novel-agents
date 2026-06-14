import assert from "node:assert/strict";
import { test } from "node:test";

import { createScriptedModel } from "@ai-novel-agents/agents";
import type { ChatCompletionInput, ModelRouter } from "@ai-novel-agents/llm";
import { openStore, type Store } from "@ai-novel-agents/store";

import {
  confirmChapterWorkflow,
  generateFoundationWorkflow,
  generateOutlineWorkflow,
  generateSettingWorkflow,
  reviseChapterWorkflow,
  writeChapterWorkflow,
} from "./index.js";
import { runWorkflow, type WorkflowDeps, type WorkflowEvent } from "./engine.js";

// ---------- 上下文感知的 mock 模型 ----------

interface MockControl {
  failReview: boolean;
  memoryNonce: number;
}

const PROSE = "废星城的酸雨连下了三天三夜，林尘蜷在管道里。".repeat(8);

function buildResponder(control: MockControl) {
  return (input: ChatCompletionInput): string => {
    const system = input.messages[0]?.content ?? "";
    const user = input.messages.at(-1)?.content ?? "";

    // 正文：非 JSON 输出
    if (input.responseFormat !== "json_object") {
      return PROSE;
    }

    if (system.includes("策划编辑")) {
      return json(foundation(user.includes("修改指令") ? "（已改）" : ""));
    }
    if (system.includes("世界观架构师")) {
      return json(setting());
    }
    if (system.includes("大纲架构师")) {
      return user.includes("卷纲") ? json(volumeOutline()) : json(mainOutline());
    }
    if (system.includes("结构编辑")) {
      return json({ score: 8, verdict: "结构稳", issues: [], suggestions: [] });
    }
    if (system.includes("主编")) {
      return json(chapterPlan());
    }
    if (system.includes("责编")) {
      return json({
        score: 8.5,
        verdict: "可发表",
        dimensions: [{ name: "节奏", score: 8, comment: "好" }],
        revisionInstructions: [],
      });
    }
    if (system.includes("一致性审查员")) {
      if (control.failReview) {
        throw new Error("模拟一致性审查崩溃");
      }
      return json({ pass: true, violations: [] });
    }
    if (system.includes("档案管理员") && user.includes("提取记忆")) {
      const foreshadowId = user.match(/id: (fs_[\w-]+)/)?.[1];
      control.memoryNonce++;
      return json({
        summary: `章摘要#${control.memoryNonce}`,
        characterStates: [
          { name: "林尘", goal: "活下去", changeNote: `变化#${control.memoryNonce}` },
        ],
        foreshadowEvents: foreshadowId
          ? [{ foreshadowId, event: "advanced", note: "推进" }]
          : [],
        newForeshadows: [],
        canonFacts: [{ category: "character", subject: "林尘", fact: `事实#${control.memoryNonce}` }],
      });
    }
    if (system.includes("压缩成卷摘要") || user.includes("生成卷摘要")) {
      return json({ content: "卷摘要" });
    }
    if (system.includes("全局前情提要")) {
      return json({ content: "前情提要" });
    }
    throw new Error(`mock 未覆盖的调用：${system.slice(0, 30)}`);
  };
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

// ---------- 固定数据 ----------

function foundation(suffix = "") {
  return {
    title: `噬星者${suffix}`,
    genre: "星际玄幻",
    logline: "废土少年吞噬星核",
    hook: "吞噬体系",
    mainConflict: "存亡战",
    storyEngine: "星核升级",
    protagonist: { name: "林尘", identity: "拾荒少年", want: "找姐姐", flaw: "不信人" },
    targetReaders: "男频",
    tone: "热血",
  };
}

function setting() {
  return {
    worldRules: ["星核不可再生"],
    locations: [{ name: "废星城", description: "贫民窟" }],
    characters: [
      {
        name: "林尘",
        role: "protagonist",
        profile: { identity: "拾荒少年", personality: "谨慎", background: "孤儿", want: "找姐姐" },
      },
    ],
    styleGuide: { voice: "第三人称", pacing: "快", forbiddenExpressions: ["命运的齿轮"] },
  };
}

function mainOutline() {
  return {
    premise: "废土崛起",
    protagonistArc: "拾荒少年到星主",
    volumes: [
      { volumeNo: 1, title: "卷一", goal: "活下来", mainConflict: "围剿", climax: "突围", estimatedChapters: 3 },
    ],
    foreshadowSeeds: [
      { title: "姐姐的下落", description: "失踪之谜", importance: "core", plantVolumeNo: 1, resolveVolumeNo: 1 },
    ],
    ending: "成为星主",
  };
}

function volumeOutline() {
  return {
    volumeNo: 1,
    title: "卷一",
    goal: "活下来",
    chapterRange: { from: 1, to: 3 },
    beats: [{ chapters: "1-3", summary: "黄金三章" }],
    foreshadowPlan: [],
    endingHook: "钩子",
  };
}

function chapterPlan() {
  return {
    title: "第一颗星核",
    objective: "觉醒",
    viewpoint: "林尘",
    scenes: [{ purpose: "拾荒", conflict: "追捕", outcome: "躲藏", characters: ["林尘"] }],
    foreshadowActions: [],
    expectedCharacterChanges: [{ name: "林尘", change: "觉醒" }],
    endingHook: "影像睁眼",
    targetWords: 200,
  };
}

// ---------- 测试装置 ----------

function setup(control: MockControl): {
  store: Store;
  deps: WorkflowDeps;
  events: WorkflowEvent[];
} {
  const store = openStore(":memory:");
  const model = createScriptedModel([buildResponder(control)]);
  const models: ModelRouter = () => model;
  const events: WorkflowEvent[] = [];
  return { store, deps: { store, models, onEvent: (e) => events.push(e) }, events };
}

async function buildNovelWithThreeChapters(control: MockControl, deps: WorkflowDeps, store: Store) {
  const novel = store.novels.create({ title: "草稿" });
  const id = novel.id;

  await runWorkflow(generateFoundationWorkflow, { novelId: id, ideas: "废土吞噬" }, deps);
  await runWorkflow(generateSettingWorkflow, { novelId: id }, deps);
  await runWorkflow(generateOutlineWorkflow, { novelId: id, scope: "main", volumeCount: 1 }, deps);
  await runWorkflow(generateOutlineWorkflow, { novelId: id, scope: "volume", volumeNo: 1 }, deps);

  for (let chapterNo = 1; chapterNo <= 3; chapterNo++) {
    const write = await runWorkflow(writeChapterWorkflow, { novelId: id, chapterNo }, deps);
    assert.equal(write.status, "completed", `第 ${chapterNo} 章写作应成功`);
    const confirm = await runWorkflow(confirmChapterWorkflow, { novelId: id, chapterNo }, deps);
    assert.equal(confirm.status, "completed", `第 ${chapterNo} 章确认应成功：${confirm.error ?? ""}`);
  }
  return id;
}

test("全链路：建书 → 写 3 章 → 确认，记忆台账落库", async () => {
  const control: MockControl = { failReview: false, memoryNonce: 0 };
  const { store, deps } = setup(control);
  const id = await buildNovelWithThreeChapters(control, deps, store);

  // 基础资产
  assert.ok(store.assets.getActive(id, "foundation"));
  assert.ok(store.assets.getActive(id, "setting"));
  assert.ok(store.outlines.getActiveMain(id));
  assert.ok(store.outlines.getActiveVolume(id, 1));

  // 伏笔：总纲种子已登记，且被章节记忆推进
  const foreshadow = store.foreshadows.findByTitle(id, "姐姐的下落");
  assert.ok(foreshadow);
  assert.equal(foreshadow!.status, "advanced");
  assert.ok(store.foreshadows.listEvents(foreshadow!.id).length >= 2); // planted + advanced

  // 三章全部确认
  const confirmed = store.chapters.list(id).filter((c) => c.status === "confirmed");
  assert.equal(confirmed.length, 3);
  assert.equal(store.chapters.nextChapterNo(id), 4);

  // 人物状态链
  const protagonist = store.characters.getByName(id, "林尘")!;
  assert.equal(store.characters.recentStates(protagonist.id, 3, 10).length, 3);

  // 章摘要 + 卷摘要（第 3 章是卷末）
  assert.equal(store.summaries.listChapterSummaries(id, 1, 3).length, 3);
  assert.ok(store.summaries.get(id, "volume", 1));

  // canon 事实
  assert.equal(store.canon.list(id).length, 3);

  // token 用量已落库
  assert.ok(store.runs.usageTotals(id).callCount > 0);

  store.close();
});

test("修改已确认章 → 重新确认，旧记忆被回滚替换", async () => {
  const control: MockControl = { failReview: false, memoryNonce: 0 };
  const { store, deps } = setup(control);
  const id = await buildNovelWithThreeChapters(control, deps, store);

  const protagonist = store.characters.getByName(id, "林尘")!;
  const before = store.characters.recentStates(protagonist.id, 2, 1)[0];
  const canonBefore = store.canon.list(id).length;

  // 修改第 2 章 → 回到 reviewed
  const revise = await runWorkflow(
    reviseChapterWorkflow,
    { novelId: id, chapterNo: 2, mode: "revise", instruction: "开头加快" },
    deps,
  );
  assert.equal(revise.status, "completed");
  assert.equal(store.chapters.get(id, 2)!.status, "reviewed");

  // 重新确认第 2 章
  const reconfirm = await runWorkflow(confirmChapterWorkflow, { novelId: id, chapterNo: 2 }, deps);
  assert.equal(reconfirm.status, "completed");

  // 第 2 章仍只有一份状态快照（旧的被回滚，新的写入）
  const states = store.characters.recentStates(protagonist.id, 2, 10).filter(
    (s) => s.chapterNo === 2,
  );
  assert.equal(states.length, 1);
  assert.notEqual(states[0].changeNote, before.changeNote);

  // canon 总数不变（第 2 章旧 canon 删除，新 canon 写入）
  assert.equal(store.canon.list(id).length, canonBefore);

  store.close();
});

test("断点恢复：失败步骤之前的步骤被跳过", async () => {
  const control: MockControl = { failReview: true, memoryNonce: 0 };
  const { store, deps } = setup(control);
  const novel = store.novels.create({ title: "草稿" });
  const id = novel.id;

  await runWorkflow(generateFoundationWorkflow, { novelId: id, ideas: "x" }, deps);
  await runWorkflow(generateSettingWorkflow, { novelId: id }, deps);
  await runWorkflow(generateOutlineWorkflow, { novelId: id, scope: "main", volumeCount: 1 }, deps);
  await runWorkflow(generateOutlineWorkflow, { novelId: id, scope: "volume", volumeNo: 1 }, deps);

  // 第一次写作：review 步骤崩溃 → run 失败
  const failed = await runWorkflow(writeChapterWorkflow, { novelId: id, chapterNo: 1 }, deps);
  assert.equal(failed.status, "failed");
  assert.equal(failed.failedStepId, "review");

  // 写作步骤已落 1 份草稿
  const chapter = store.chapters.get(id, 1)!;
  assert.equal(store.chapters.listDrafts(chapter.id).length, 1);

  // 修好模型并恢复
  control.failReview = false;
  const events: WorkflowEvent[] = [];
  const resumed = await runWorkflow(
    writeChapterWorkflow,
    { novelId: id, chapterNo: 1 },
    { ...deps, onEvent: (e) => events.push(e) },
    { resumeRunId: failed.runId },
  );
  assert.equal(resumed.status, "completed");

  // plan 与 write 被跳过，没有重复写作（仍只有 1 份 write 草稿）
  const skipped = events.filter((e) => e.type === "step:skipped").map((e) => (e as { stepId: string }).stepId);
  assert.deepEqual(skipped.sort(), ["plan", "resolve", "write"]);
  assert.equal(
    store.chapters.listDrafts(chapter.id).filter((d) => d.source === "write").length,
    1,
  );

  store.close();
});
