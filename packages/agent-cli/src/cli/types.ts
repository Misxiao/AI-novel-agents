import type { ChatModel } from "../../../agents/src/index.js";
import type { InitialOutlineDraft } from "../../../agents/src/index.js";
import type {
  ChapterProductionRepositoryLike,
  NovelPreflightRepositoryLike,
  NovelWorkspaceRepositoryLike,
} from "../../../repositories/src/index.js";

export interface CliSessionState {
  activeNovelId?: string;
}

export interface CliIO {
  write(message: string): void;
  writeError(message: string): void;
  question(prompt: string): Promise<string>;
}

export type CliOptionValue = string | string[] | boolean;

export interface ParsedCommand {
  path: string[];
  positionals: string[];
  options: Record<string, CliOptionValue>;
}

export interface CliCommandResult {
  data?: unknown;
  lines?: string[];
  exitCode: 0 | 1 | 2;
  shouldExit?: boolean;
}

export interface CliServices {
  workspace: NovelWorkspaceRepositoryLike;
  preflight: NovelPreflightRepositoryLike;
  chapter: ChapterProductionRepositoryLike;
}

export interface CliCommandContext {
  session: CliSessionState;
  io: CliIO;
  services: CliServices;
  interactive: boolean;
  dbPath: string;
  createMockModel?: (
    capability: "preflight" | "revise-master" | "revise-volume" | "chapter-write",
    novelId: string,
    options?: {
      sourceOutline?: InitialOutlineDraft;
      instruction?: string;
      volumeId?: string;
      chapterPlanCount?: number;
      targetWords?: number;
      hasExistingChapterPlan?: boolean;
    },
  ) => ChatModel;
}

export interface CommandDefinition {
  path: string[];
  summary: string;
  usage: string;
  examples: string[];
  allowedOptions: string[];
  maxPositionals: number;
  execute(
    context: CliCommandContext,
    command: ParsedCommand,
  ): Promise<CliCommandResult>;
}

export interface ResolvedCommand {
  definition: CommandDefinition;
  args: string[];
}
