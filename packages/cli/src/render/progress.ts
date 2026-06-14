import type { WorkflowEvent } from "@ai-novel-agents/workflow";

import { color, formatDuration, formatTokens } from "../util.js";

/**
 * 把 workflow 事件渲染到终端：非流式步骤显示进度行，
 * 流式正文直接打印（让用户看到正文实时生成）。
 */
export function createProgressRenderer(): {
  onEvent: (event: WorkflowEvent) => void;
} {
  let streaming = false;
  const write = (text: string) => process.stdout.write(text);

  return {
    onEvent(event) {
      switch (event.type) {
        case "run:start":
          write(`\n${color.cyan("▶")} ${color.bold(event.title)}\n`);
          break;
        case "step:start":
          streaming = false;
          write(`  ${color.gray(`${event.seq}/${event.total}`)} ${event.title}`);
          break;
        case "step:delta":
          if (!streaming) {
            streaming = true;
            write("\n");
          }
          write(color.dim(event.text));
          break;
        case "step:done":
          write(
            streaming
              ? `\n  ${color.green("✓")} ${color.gray(formatDuration(event.durationMs))}\n`
              : ` ${color.green("✓")} ${color.gray(formatDuration(event.durationMs))}\n`,
          );
          break;
        case "step:skipped":
          write(`  ${color.gray("⤼")} ${color.gray(`${event.title}（已完成，跳过）`)}\n`);
          break;
        case "step:retry":
          write(`\n  ${color.yellow("↻")} 重试（第 ${event.attempt} 次）：${color.dim(event.error)}\n`);
          break;
        case "run:done":
          write(
            `  ${color.green("✓ 完成")} ${color.gray(`· ${formatTokens(event.totalUsage.totalTokens ?? 0)} tokens`)}\n`,
          );
          break;
        case "run:failed":
          write(`\n  ${color.red("✗ 失败")}：${event.error}\n`);
          break;
      }
    },
  };
}
