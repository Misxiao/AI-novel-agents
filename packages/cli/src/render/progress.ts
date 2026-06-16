import type { WorkflowEvent } from "@ai-novel-agents/workflow";

import { color, formatDuration, formatTokens } from "../util.js";

const FRAMES = ["·  ", "·· ", "···"];
const CLEAR_LINE = "\x1b[2K\r";

/**
 * 把 workflow 事件渲染到终端：
 * - 非流式步骤显示跳动的进度动画（仅 TTY）
 * - 流式正文直接打印（正文本身就是反馈，不再加动画）
 */
export function createProgressRenderer(): { onEvent: (event: WorkflowEvent) => void } {
  const write = (text: string) => process.stdout.write(text);
  const tty = process.stdout.isTTY === true;

  let streaming = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let stepLine = "";

  const stopSpinner = () => {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };

  return {
    onEvent(event) {
      switch (event.type) {
        case "run:start":
          write(`\n${color.cyan("▶")} ${color.bold(event.title)}\n`);
          break;

        case "step:start": {
          streaming = false;
          stepLine = `  ${color.gray(`${event.seq}/${event.total}`)} ${event.title}`;
          if (tty) {
            let i = 0;
            const tick = () => write(`${CLEAR_LINE}${stepLine} ${color.cyan(FRAMES[i++ % FRAMES.length])}`);
            tick();
            timer = setInterval(tick, 180);
          } else {
            write(stepLine);
          }
          break;
        }

        case "step:delta":
          if (!streaming) {
            streaming = true;
            stopSpinner();
            write(`${tty ? CLEAR_LINE : ""}${stepLine}\n`);
          }
          write(color.dim(event.text));
          break;

        case "step:done":
          stopSpinner();
          write(
            streaming
              ? `\n  ${color.green("✓")} ${color.gray(formatDuration(event.durationMs))}\n`
              : `${tty ? CLEAR_LINE : " "}${stepLine} ${color.green("✓")} ${color.gray(formatDuration(event.durationMs))}\n`,
          );
          break;

        case "step:skipped":
          stopSpinner();
          write(`${tty ? CLEAR_LINE : ""}  ${color.gray("⤼")} ${color.gray(`${event.title}（已完成，跳过）`)}\n`);
          break;

        case "step:retry":
          stopSpinner();
          write(`\n  ${color.yellow("↻")} 重试（第 ${event.attempt} 次）：${color.dim(event.error)}\n`);
          break;

        case "run:done":
          stopSpinner();
          write(`  ${color.green("✓ 完成")} ${color.gray(`· ${formatTokens(event.totalUsage.totalTokens ?? 0)} tokens`)}\n`);
          break;

        case "run:failed":
          stopSpinner();
          write(`\n  ${color.red("✗ 失败")}：${event.error}\n`);
          break;
      }
    },
  };
}
