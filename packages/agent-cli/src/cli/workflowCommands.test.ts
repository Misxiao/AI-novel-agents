import { NovelDatabase } from "../../../db/src/index.js";
import {
  ChapterProductionRepository,
  NovelPreflightRepository,
  NovelWorkspaceRepository,
} from "../../../repositories/src/index.js";
import { createCommandRegistry } from "./commands.js";
import { createCliMockModel } from "./mockModels.js";
import { CliRuntime } from "./runtime.js";
import type { CliIO } from "./types.js";

const dbPath = `/private/tmp/ai-novel-cli-workflows-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const db = new NovelDatabase(dbPath);
const repository = new NovelWorkspaceRepository(db);
const io = createFakeIO([]);
const runtime = new CliRuntime({
  registry: createCommandRegistry(),
  io,
  dbPath,
  services: {
    workspace: repository,
    preflight: new NovelPreflightRepository(db),
    chapter: new ChapterProductionRepository(db),
  },
  createMockModel: createCliMockModel,
});

await runtime.executeTokens(["novel", "create"], true);
const novelId = runtime.session.activeNovelId!;

const missingSeed = await runtime.executeTokens(["preflight", "run", "--mock"], false);
assertEqual(missingSeed.exitCode, 2);

const preflight = await runtime.executeTokens([
  "preflight",
  "run",
  "--seed-notes",
  "主角必须在失忆前关闭裂界",
  "--target-words=800000",
  "--chapter-plans",
  "10",
  "--mock",
], false);
assertEqual(preflight.exitCode, 0);
assertEqual(
  (preflight.data as { task: { status: string } }).task.status,
  "waiting_for_user",
);
assertEqual(
  (preflight.data as { foundationDraft: { targetWords: number } }).foundationDraft.targetWords,
  800000,
);
assertEqual(repository.getDraft(novelId, "outline")?.status, "待确认");

const volumeRevision = await runtime.executeTokens([
  "outline",
  "revise-volume",
  "volume-1",
  "--instruction",
  "把第一卷改为营救失踪盟友",
  "--mock",
], false);
assertEqual(volumeRevision.exitCode, 0);
assertEqual(
  (volumeRevision.data as { version: { scope: string } }).version.scope,
  "volume",
);

const masterRevision = await runtime.executeTokens([
  "outline",
  "revise-master",
  "--instruction=把最终决战提前",
  "--mock",
], false);
assertEqual(masterRevision.exitCode, 0);
assertEqual(repository.listOutlineVersions(novelId).length, 2);

const confirmation = await runtime.executeTokens([
  "outline",
  "confirm",
  "--title",
  "裂界回声",
], false);
assertEqual(confirmation.exitCode, 0);
assertEqual(
  (confirmation.data as { task: { status: string } }).task.status,
  "succeeded",
);

const chapter = await runtime.executeTokens([
  "chapter",
  "write",
  "--chapter-no=1",
  "--intent",
  "主角主动试探裂界",
  "--target-words=200",
  "--mock",
], false);
if (chapter.exitCode !== 0) {
  throw new Error(`章节命令失败：${JSON.stringify(chapter)}`);
}
assertEqual(
  (chapter.data as { task: { workflowName: string } }).task.workflowName,
  "write-next-chapter",
);
assertEqual(
  (chapter.data as { missingAssets: string[] }).missingAssets.length,
  0,
);
const chapterTaskId = (chapter.data as { task: { taskId: string } }).task.taskId;
assertEqual(repository.getTask(chapterTaskId)?.status, "succeeded");
assertEqual(db.getChapterContext(novelId, 1)?.status, "draft");

const interactiveRuntime = new CliRuntime({
  registry: createCommandRegistry(),
  io: createFakeIO(["交互式初步想法", "100000", "10"]),
  dbPath,
  services: {
    workspace: repository,
    preflight: new NovelPreflightRepository(db),
    chapter: new ChapterProductionRepository(db),
  },
  session: { activeNovelId: novelId },
  createMockModel: createCliMockModel,
});
const prompted = await interactiveRuntime.executeTokens(
  ["preflight", "run", "--mock"],
  true,
);
assertEqual(prompted.exitCode, 0);

function createFakeIO(answers: string[]): CliIO {
  return {
    write() {},
    writeError() {},
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
