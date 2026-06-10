#!/usr/bin/env node

import { NovelDatabase, defaultDatabasePath } from "../../db/src/index.js";
import {
  ChapterProductionRepository,
  NovelPreflightRepository,
  NovelWorkspaceRepository,
} from "../../repositories/src/index.js";
import { runCli } from "./cli/app.js";
import { createCommandRegistry } from "./cli/commands.js";
import { loadLocalEnv } from "./cli/env.js";
import { createCliMockModel } from "./cli/mockModels.js";
import { CliRuntime } from "./cli/runtime.js";
import { TerminalCliIO } from "./cli/terminalIO.js";

export async function main(args = process.argv.slice(2)) {
  loadLocalEnv();
  const dbPath = defaultDatabasePath();
  const db = new NovelDatabase(dbPath);
  const io = new TerminalCliIO();
  const runtime = new CliRuntime({
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

  try {
    return await runCli(args, runtime, io);
  } finally {
    io.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
