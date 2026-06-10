import type { StoredNovel } from "../../../db/src/index.js";
import { CliBusinessError, CliUsageError } from "./errors.js";
import type {
  CliCommandContext,
  CliOptionValue,
  ParsedCommand,
} from "./types.js";

export function readStringOption(command: ParsedCommand, name: string) {
  const value = command.options[name];
  if (Array.isArray(value)) return value.at(-1);
  return typeof value === "string" ? value : undefined;
}

export function readBooleanOption(command: ParsedCommand, name: string) {
  return command.options[name] === true;
}

export function readIntegerOption(
  command: ParsedCommand,
  name: string,
  options: { min?: number; max?: number } = {},
) {
  const value = readStringOption(command, name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new CliUsageError(`--${name} 必须是整数。`);
  }
  if (options.min !== undefined && parsed < options.min) {
    throw new CliUsageError(`--${name} 不能小于 ${options.min}。`);
  }
  if (options.max !== undefined && parsed > options.max) {
    throw new CliUsageError(`--${name} 不能大于 ${options.max}。`);
  }
  return parsed;
}

export function resolveNovelId(
  context: CliCommandContext,
  command: ParsedCommand,
  positional?: string,
) {
  const novelId = readStringOption(command, "novel-id")
    || positional
    || context.session.activeNovelId;
  if (!novelId) {
    throw new CliUsageError(
      "尚未选择小说。请先执行 novel use <novelId>，或传入 --novel-id。",
    );
  }
  return novelId;
}

export function requireNovel(
  context: CliCommandContext,
  novelId: string,
): StoredNovel {
  const novel = context.services.workspace.getNovel(novelId);
  if (!novel) {
    throw new CliBusinessError(`未找到小说项目：${novelId}`);
  }
  return novel;
}

export function displayNovelTitle(novel: Pick<StoredNovel, "title">) {
  return novel.title.trim() || "未命名小说";
}

export function optionEntries(
  options: Record<string, CliOptionValue>,
) {
  return Object.entries(options);
}
