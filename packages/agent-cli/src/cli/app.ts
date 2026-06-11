import { tokenizeCommandLine } from "./parser.js";
import { CliRuntime } from "./runtime.js";
import type { CliCommandResult, CliIO } from "./types.js";

export async function runCli(
  args: string[],
  runtime: CliRuntime,
  io: CliIO,
) {
  if (args.length === 0) {
    return runInteractiveCli(runtime, io);
  }
  const result = await runtime.executeTokens(args, false);
  renderResult(io, result, hasJsonFlag(args));
  return result.exitCode;
}

export async function runInteractiveCli(
  runtime: CliRuntime,
  io: CliIO,
) {
  io.setCompletionProvider?.((line) => runtime.completeLine(line));
  io.write("AI 小说创作工作台。输入 help 查看命令，输入 exit 退出。");
  while (true) {
    let line: string;
    try {
      line = await io.question(buildPrompt(runtime));
    } catch {
      io.write("");
      return 0;
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    let tokens: string[];
    try {
      tokens = tokenizeCommandLine(trimmed);
    } catch (error) {
      io.writeError(error instanceof Error ? error.message : String(error));
      continue;
    }

    try {
      const result = await runtime.executeTokens(tokens, true);
      renderResult(io, result, hasJsonFlag(tokens));
      if (result.shouldExit) {
        return result.exitCode;
      }
    } catch (error) {
      io.writeError(
        `命令执行异常：${error instanceof Error ? error.message : String(error)}`,
      );
      io.writeError("当前命令已终止，CLI 可以继续使用。");
    }
  }
}

export function renderResult(
  io: CliIO,
  result: CliCommandResult,
  json: boolean,
) {
  if (json) {
    const payload = result.data ?? {
      exitCode: result.exitCode,
      messages: result.lines ?? [],
    };
    const output = JSON.stringify(payload, null, 2);
    if (result.exitCode === 0) io.write(output);
    else io.writeError(output);
    return;
  }

  const lines = result.lines ?? [];
  if (lines.length === 0) return;
  const output = lines.join("\n");
  if (result.exitCode === 0) io.write(output);
  else io.writeError(output);
}

function buildPrompt(runtime: CliRuntime) {
  return `ai-novel[${runtime.getActiveNovelTitle()}]> `;
}

function hasJsonFlag(tokens: string[]) {
  return tokens.some((token) => token === "--json" || token === "--json=true");
}
