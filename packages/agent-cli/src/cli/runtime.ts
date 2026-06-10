import { CliBusinessError, CliUsageError } from "./errors.js";
import { parseCommandArgs } from "./parser.js";
import { CommandRegistry } from "./registry.js";
import type {
  CliCommandContext,
  CliCommandResult,
  CliIO,
  CliServices,
  CliSessionState,
} from "./types.js";

export interface CliRuntimeOptions {
  registry: CommandRegistry;
  io: CliIO;
  services: CliServices;
  dbPath: string;
  session?: CliSessionState;
  createMockModel?: CliCommandContext["createMockModel"];
}

export class CliRuntime {
  readonly session: CliSessionState;
  readonly registry: CommandRegistry;
  private readonly context: Omit<CliCommandContext, "interactive">;

  constructor(options: CliRuntimeOptions) {
    this.registry = options.registry;
    this.session = options.session ?? {};
    this.context = {
      session: this.session,
      io: options.io,
      services: options.services,
      dbPath: options.dbPath,
      createMockModel: options.createMockModel,
    };
  }

  async executeTokens(
    tokens: string[],
    interactive: boolean,
  ): Promise<CliCommandResult> {
    if (tokens.length === 0) {
      return { exitCode: 0 };
    }
    const resolved = this.registry.resolve(tokens);
    if (!resolved) {
      return {
        exitCode: 2,
        lines: [`未知命令：${tokens.join(" ")}`, "输入 help 查看可用命令。"],
      };
    }

    try {
      const parsed = parseCommandArgs(resolved.args);
      parsed.path = resolved.definition.path;
      const unknownOptions = Object.keys(parsed.options).filter(
        (name) => !resolved.definition.allowedOptions.includes(name),
      );
      if (unknownOptions.length > 0) {
        throw new CliUsageError(
          `未知选项：${unknownOptions.map((name) => `--${name}`).join("、")}`,
        );
      }
      if (parsed.positionals.length > resolved.definition.maxPositionals) {
        throw new CliUsageError(
          `多余的位置参数：${parsed.positionals.slice(resolved.definition.maxPositionals).join(" ")}`,
        );
      }
      return await resolved.definition.execute(
        { ...this.context, interactive },
        parsed,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof CliUsageError) {
        return {
          exitCode: error.exitCode,
          lines: [
            message,
            `用法: ${resolved.definition.usage}`,
            `输入 help ${resolved.definition.path.join(" ")} 查看说明。`,
          ],
        };
      }
      if (error instanceof CliBusinessError) {
        return { exitCode: error.exitCode, lines: [message] };
      }
      return { exitCode: 1, lines: [message] };
    }
  }

  getActiveNovelTitle() {
    const novelId = this.session.activeNovelId;
    if (!novelId) return "未选择";
    const novel = this.context.services.workspace.getNovel(novelId);
    return novel?.title.trim() || novelId;
  }
}
