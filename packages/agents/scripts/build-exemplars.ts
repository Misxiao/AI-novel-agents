// 把 External 语料库的 excerpts.csv 预构建为 resources/exemplars.json，
// 使运行时不依赖 external 目录存在。用法：pnpm --filter @ai-novel-agents/agents build:exemplars
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const csvPath = resolve(
  here,
  "../../../external/learning-sources/Chinese-WebNovel-Skill/analysis/excerpts.csv",
);
const outPath = resolve(here, "../resources/exemplars.json");

/** 极简 CSV 解析：支持双引号包裹与引号转义（""） */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
    } else {
      field += char;
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const [header, ...records] = parseCsv(readFileSync(csvPath, "utf8"));
const col = (name: string) => {
  const index = header.indexOf(name);
  if (index < 0) throw new Error(`CSV 缺少列：${name}`);
  return index;
};

const MAX_TEXT_CHARS = 1200;

/** 超长摘录在段落边界截断，保留开头（摘录价值集中在起笔处） */
function clip(text: string): string {
  if (text.length <= MAX_TEXT_CHARS) {
    return text;
  }
  const head = text.slice(0, MAX_TEXT_CHARS);
  const lastBreak = head.lastIndexOf("\n");
  return (lastBreak > MAX_TEXT_CHARS * 0.6 ? head.slice(0, lastBreak) : head) + "\n（已截断）";
}

const exemplars = records
  .map((record) => ({
    id: record[col("excerpt_id")],
    title: record[col("title")],
    type: record[col("excerpt_type")],
    tags: record[col("tags")].split("|").filter(Boolean),
    text: clip(record[col("text")].trim()),
  }))
  .filter((exemplar) => exemplar.text.length >= 20);

writeFileSync(outPath, JSON.stringify(exemplars, null, 1), "utf8");
console.log(`已写入 ${exemplars.length} 条范文摘录 → ${outPath}`);
