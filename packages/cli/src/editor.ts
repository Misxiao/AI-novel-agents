import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * 用 $EDITOR 打开一段内容供手工编辑，返回保存后的新内容。
 * 用户未改动或退出码非 0 时返回 undefined。
 */
export function editInEditor(initial: string, extension = "md"): string | undefined {
  const editor = process.env.EDITOR ?? process.env.VISUAL ?? "vi";
  const dir = mkdtempSync(join(tmpdir(), "ai-novel-"));
  const file = join(dir, `edit.${extension}`);
  writeFileSync(file, initial, "utf8");

  const result = spawnSync(editor, [file], { stdio: "inherit" });
  if (result.status !== 0) {
    return undefined;
  }
  const edited = readFileSync(file, "utf8");
  return edited === initial ? undefined : edited;
}
