import { NovelDatabase } from "../../db/src/index.js";
import { NovelWorkspaceRepository } from "./index.js";

const dbPath = `/private/tmp/ai-novel-workspace-repository-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const db = new NovelDatabase(dbPath);
const repository = new NovelWorkspaceRepository(db);

const first = repository.createEmptyNovel();
const second = repository.createEmptyNovel();
const updated = repository.updateNovel(first.novelId, {
  title: "裂界回声",
  genre: "玄幻悬疑",
  hook: "主角必须在失忆前关闭裂界。",
});

assertEqual(repository.listNovels().length, 2);
assertEqual(updated?.title, "裂界回声");
assertEqual(repository.getNovel(first.novelId)?.genre, "玄幻悬疑");
assertEqual(repository.getNovel("missing"), null);

repository.saveTask({
  taskId: "task-first",
  novelId: first.novelId,
  title: "测试任务",
  workflowName: "test",
  status: "failed",
  inputSnapshot: "输入",
  outputSnapshot: "失败",
  error: "测试错误",
  startedAt: "2026-06-05T00:00:00.000Z",
  finishedAt: "2026-06-05T00:00:01.000Z",
});

assertEqual(repository.listTasks(first.novelId).length, 1);
assertEqual(repository.listTasks(second.novelId).length, 0);
assertEqual(repository.getTask("task-first")?.novelId, first.novelId);
assertEqual(repository.getTask("missing"), null);

assertEqual(repository.getDraft(first.novelId, "outline"), null);
assertEqual(repository.listOutlineVersions(first.novelId).length, 0);

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`断言失败：expected ${String(expected)}, got ${String(actual)}`);
  }
}
