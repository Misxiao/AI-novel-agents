import { color } from "../util.js";

/**
 * 渲染一个带标题的内容区块：左竖线 + 标题，无右边框。
 * 不做盒宽计算，因此中文（全宽字符）也永远不会让边框错位。
 */
export function section(title: string, body: string): void {
  process.stdout.write(`\n${color.cyan("◇")} ${color.bold(title)}\n`);
  for (const line of body.split("\n")) {
    process.stdout.write(`${color.gray("│")} ${line}\n`);
  }
}
