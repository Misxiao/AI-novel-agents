import { NovelDatabase } from "../../../db/src/index.js";
import {
  ChapterProductionRepository,
  NovelPreflightRepository,
  NovelWorkspaceRepository,
} from "../../../repositories/src/index.js";
import { createCommandRegistry } from "./commands.js";
import { CliRuntime } from "./runtime.js";
import type { CliIO } from "./types.js";

const dbPath = `/private/tmp/ai-novel-cli-workspace-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const db = new NovelDatabase(dbPath);
const io = createFakeIO([]);
const runtime = new CliRuntime({
  registry: createCommandRegistry(),
  io,
  dbPath,
  services: {
    workspace: new NovelWorkspaceRepository(db),
    preflight: new NovelPreflightRepository(db),
    chapter: new ChapterProductionRepository(db),
  },
});

const created = await runtime.executeTokens(["novel", "create"], false);
assertEqual(created.exitCode, 0);
assertOk(runtime.session.activeNovelId);

const novelId = runtime.session.activeNovelId!;
const updated = await runtime.executeTokens([
  "novel",
  "update",
  "--title",
  "裂界回声",
  "--genre=玄幻悬疑",
  "--hook",
  "主角必须在失忆前关闭裂界。",
], false);
assertEqual(updated.exitCode, 0);

const list = await runtime.executeTokens(["novel", "list"], false);
assertOk(list.lines?.some((line) => line.includes("裂界回声")));

const shown = await runtime.executeTokens(["novel", "show"], false);
assertEqual((shown.data as { novelId: string }).novelId, novelId);

const second = await runtime.executeTokens(["novel", "create", "--json"], false);
const secondId = (second.data as { novelId: string }).novelId;
assertEqual(runtime.session.activeNovelId, secondId);

const selected = await runtime.executeTokens(["novel", "use", novelId], false);
assertEqual(selected.exitCode, 0);
assertEqual(runtime.session.activeNovelId, novelId);

const context = await runtime.executeTokens(["context"], false);
assertOk(context.lines?.some((line) => line.includes("裂界回声")));
assertOk(context.lines?.some((line) => line.includes(dbPath)));

const preflightRepository = new NovelPreflightRepository(db);
preflightRepository.saveDraft({
  novelId,
  kind: "foundation",
  status: "待确认",
  asset: { novelId, titleCandidates: ["裂界回声"] },
});
preflightRepository.saveDraft({
  novelId,
  kind: "outline",
  status: "待确认",
  asset: {
    novelId,
    masterOutline: { opening: "裂界开启" },
    volumes: [],
    chapterPlans: [],
  },
});
preflightRepository.saveOutlineVersion({
  novelId,
  versionId: "outline-version-cli-test",
  scope: "master",
  status: "待确认",
  createdAt: "2026-06-05T00:00:00.000Z",
  version: {
    versionId: "outline-version-cli-test",
    novelId,
    scope: "master",
    instruction: "收紧开篇",
    revisedOutline: { novelId, masterOutline: { opening: "裂界提前开启" } },
    status: "待确认",
  },
});
const workspaceRepository = new NovelWorkspaceRepository(db);
workspaceRepository.saveTask({
  taskId: "task-cli-test",
  novelId,
  title: "测试任务",
  workflowName: "test-workflow",
  status: "failed",
  inputSnapshot: "输入",
  outputSnapshot: "失败",
  error: "测试错误",
  startedAt: "2026-06-05T00:00:00.000Z",
  finishedAt: "2026-06-05T00:00:01.000Z",
});

const assets = await runtime.executeTokens(["asset", "show", "all"], false);
assertOk(assets.lines?.join("\n").includes("foundation"));
assertOk(assets.lines?.join("\n").includes("outline"));

const outline = await runtime.executeTokens(["outline", "show"], false);
assertEqual(
  ((outline.data as { masterOutline: { opening: string } }).masterOutline.opening),
  "裂界提前开启",
);

const history = await runtime.executeTokens(["outline", "history"], false);
assertOk(history.lines?.join("\n").includes("outline-version-cli-test"));

const taskList = await runtime.executeTokens(["task", "list", "--status=failed"], false);
assertOk(taskList.lines?.join("\n").includes("task-cli-test"));

const taskShow = await runtime.executeTokens(["task", "show", "task-cli-test"], false);
assertEqual((taskShow.data as { status: string }).status, "failed");

const missing = await runtime.executeTokens(["novel", "show", "missing"], false);
assertEqual(missing.exitCode, 1);

const unknown = await runtime.executeTokens(["does-not-exist"], false);
assertEqual(unknown.exitCode, 2);

const unknownOption = await runtime.executeTokens(["novel", "list", "--wat"], false);
assertEqual(unknownOption.exitCode, 2);

const extraPositional = await runtime.executeTokens(["novel", "list", "unexpected"], false);
assertEqual(extraPositional.exitCode, 2);

const help = await runtime.executeTokens(["help", "novel", "list"], false);
assertOk(help.lines?.join("\n").includes("查看小说列表"));

function createFakeIO(answers: string[]): CliIO & { output: string[]; errors: string[] } {
  return {
    output: [],
    errors: [],
    write(message) {
      this.output.push(message);
    },
    writeError(message) {
      this.errors.push(message);
    },
    async question() {
      return answers.shift() ?? "";
    },
  };
}

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`断言失败：expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertOk(value: unknown) {
  if (!value) {
    throw new Error("断言失败：expected truthy value");
  }
}
