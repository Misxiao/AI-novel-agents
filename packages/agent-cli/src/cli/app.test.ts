import { NovelDatabase } from "../../../db/src/index.js";
import {
  ChapterProductionRepository,
  NovelPreflightRepository,
  NovelWorkspaceRepository,
} from "../../../repositories/src/index.js";
import { runCli, runInteractiveCli } from "./app.js";
import { createCommandRegistry } from "./commands.js";
import { createCliMockModel } from "./mockModels.js";
import { CliRuntime } from "./runtime.js";
import type { CliIO } from "./types.js";

const dbPath = `/private/tmp/ai-novel-cli-app-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const db = new NovelDatabase(dbPath);

const oneShotIO = createFakeIO([]);
const oneShotRuntime = createRuntime(oneShotIO);
const helpExitCode = await runCli(["help", "novel"], oneShotRuntime, oneShotIO);
assertEqual(helpExitCode, 0);
assertOk(oneShotIO.output.join("\n").includes("novel list"));

const jsonIO = createFakeIO([]);
const jsonRuntime = createRuntime(jsonIO);
const jsonExitCode = await runCli(
  ["novel", "create", "--json"],
  jsonRuntime,
  jsonIO,
);
assertEqual(jsonExitCode, 0);
const json = JSON.parse(jsonIO.output.join("\n")) as { novelId: string };
assertOk(json.novelId.startsWith("novel-"));

const interactiveIO = createFakeIO([
  "novel create",
  "novel update --title 交互小说",
  "novel list",
  "exit",
]);
const interactiveRuntime = createRuntime(interactiveIO);
const interactiveExitCode = await runInteractiveCli(
  interactiveRuntime,
  interactiveIO,
);
assertEqual(interactiveExitCode, 0);
assertOk(interactiveIO.prompts.some((prompt) => prompt.includes("未选择")));
assertOk(interactiveIO.prompts.some((prompt) => prompt.includes("交互小说")));
assertOk(interactiveIO.output.join("\n").includes("交互小说"));

const freshRuntime = createRuntime(createFakeIO([]));
assertEqual(freshRuntime.session.activeNovelId, undefined);

function createRuntime(io: CliIO) {
  return new CliRuntime({
    registry: createCommandRegistry(),
    io,
    dbPath,
    services: {
      workspace: new NovelWorkspaceRepository(db),
      preflight: new NovelPreflightRepository(db),
      chapter: new ChapterProductionRepository(db),
    },
    createMockModel: createCliMockModel,
  });
}

function createFakeIO(answers: string[]): CliIO & {
  output: string[];
  errors: string[];
  prompts: string[];
} {
  return {
    output: [],
    errors: [],
    prompts: [],
    write(message) {
      this.output.push(message);
    },
    writeError(message) {
      this.errors.push(message);
    },
    async question(prompt) {
      this.prompts.push(prompt);
      return answers.shift() ?? "exit";
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
