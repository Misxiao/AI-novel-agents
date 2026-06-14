import assert from "node:assert/strict";
import { test } from "node:test";

import { openStore } from "@ai-novel-agents/store";
import {
  confirmChapterWorkflow,
  generateFoundationWorkflow,
  generateOutlineWorkflow,
  generateSettingWorkflow,
  reviseChapterWorkflow,
  runWorkflow,
  writeChapterWorkflow,
} from "@ai-novel-agents/workflow";

import { createMockRouter } from "./mockModels.js";

test("--mock 内容能跑通全链路：建书→写章→确认→改章", async () => {
  const store = openStore(":memory:");
  const models = createMockRouter();
  const deps = { store, models };
  const novel = store.novels.create({ title: "未命名" });
  const id = novel.id;

  const expectOk = (result: { status: string; error?: string }, label: string) =>
    assert.equal(result.status, "completed", `${label}：${result.error ?? ""}`);

  expectOk(await runWorkflow(generateFoundationWorkflow, { novelId: id, ideas: "废土吞噬" }, deps), "基础盘");
  expectOk(await runWorkflow(generateSettingWorkflow, { novelId: id }, deps), "设定");
  expectOk(
    await runWorkflow(generateOutlineWorkflow, { novelId: id, scope: "main", volumeCount: 2 }, deps),
    "总纲",
  );
  expectOk(
    await runWorkflow(generateOutlineWorkflow, { novelId: id, scope: "volume", volumeNo: 1 }, deps),
    "卷纲",
  );
  expectOk(await runWorkflow(writeChapterWorkflow, { novelId: id, chapterNo: 1 }, deps), "写第1章");
  expectOk(await runWorkflow(confirmChapterWorkflow, { novelId: id, chapterNo: 1 }, deps), "确认第1章");
  expectOk(
    await runWorkflow(reviseChapterWorkflow, { novelId: id, chapterNo: 1, mode: "revise", instruction: "开头加快" }, deps),
    "改第1章",
  );

  // 基础盘字段完整
  const foundation = store.assets.getActive(id, "foundation");
  assert.ok(foundation);
  // 设定登记了角色
  assert.ok(store.characters.list(id).length >= 2);
  // 总纲伏笔种子登记
  assert.ok(store.foreshadows.list(id).length >= 1);
  // 第一章已确认 + 记忆落库
  assert.equal(store.chapters.get(id, 1)!.status, "reviewed"); // 改后回到 reviewed
  assert.ok(store.summaries.get(id, "chapter", 1));

  store.close();
});
