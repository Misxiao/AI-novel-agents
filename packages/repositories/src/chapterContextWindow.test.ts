import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NovelDatabase } from "../../db/src/index.js";
import { ChapterProductionRepository } from "./index.js";

const dbPath = join(mkdtempSync(join(tmpdir(), "chapter-context-window-")), "test.sqlite");
const db = new NovelDatabase(dbPath);
const novel = db.createNovel({
  title: "回声城",
  genre: "悬疑",
  seedIdea: "主角能听见死者回声。",
  targetWords: 300000,
});

db.saveOutlineResult({
  task: {
    taskId: "task-outline-context-window",
    novelId: novel.novelId,
    title: "生成大纲",
    workflowName: "outline-planning",
    status: "succeeded",
    inputSnapshot: "测试大纲",
    outputSnapshot: "测试大纲已生成",
    startedAt: "2026-06-05T00:00:00.000Z",
    finishedAt: "2026-06-05T00:00:01.000Z",
  },
  outline: {
    novelId: novel.novelId,
    volumes: [{ title: "第一卷" }],
  },
  chapterPlans: Array.from({ length: 8 }, (_, index) => {
    const chapterNo = index + 1;
    return {
      id: `plan-${chapterNo}`,
      novelId: novel.novelId,
      chapterNo,
      title: `第${chapterNo}章`,
      volumeTitle: "第一卷",
      objective: `推进第${chapterNo}章目标`,
      hook: `第${chapterNo}章钩子`,
      status: "已确认",
    };
  }),
});

for (const chapterNo of [1, 2, 3, 5, 6]) {
  db.saveChapterContext({
    novelId: novel.novelId,
    chapterNo,
    title: `第${chapterNo}章`,
    summary: `第${chapterNo}章摘要`,
    content: `第${chapterNo}章正文开头。\n\n第${chapterNo}章正文结尾，留下第${chapterNo}章承接点。`,
    endingHook: `第${chapterNo}章结尾钩子`,
    status: "confirmed",
  });
}

const repository = new ChapterProductionRepository(db);
const assets = repository.assembleChapterProductionContext({
  novelId: novel.novelId,
  chapterNo: 4,
});

assertEqual(assets.context.previousChapters?.map((item) => item.chapterNo).join(","), "1,2,3");
assertEqual(assets.context.previousChapters?.find((item) => item.chapterNo === 3)?.content?.includes("第3章正文开头"), true);
assertEqual(assets.context.previousChapters?.find((item) => item.chapterNo === 2)?.content, undefined);
assertEqual(assets.context.previousChapterEnding?.includes("第3章正文结尾"), true);
assertEqual(assets.context.nextChapters?.map((item) => item.chapterNo).join(","), "5,6");
assertEqual(assets.context.nextChapters?.find((item) => item.chapterNo === 5)?.content?.includes("第5章正文开头"), true);
assertEqual(assets.context.nextChapters?.find((item) => item.chapterNo === 6)?.content, undefined);
assertEqual(assets.context.nearbyChapterPlans?.map((item) => item.chapterNo).join(","), "1,2,3,5,6,7");

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`断言失败：expected ${String(expected)}, got ${String(actual)}`);
  }
}
