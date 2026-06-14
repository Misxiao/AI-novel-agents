import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ESC = "\x1b[";
const wrap = (code: string) => (text: string | number) => `${ESC}${code}m${text}${ESC}0m`;

export const color = {
  dim: wrap("2"),
  bold: wrap("1"),
  green: wrap("32"),
  red: wrap("31"),
  cyan: wrap("36"),
  yellow: wrap("33"),
  magenta: wrap("35"),
  gray: wrap("90"),
};

/** 极简 .env 加载：把 repo 根目录的 .env 合并进 process.env（不覆盖已有值） */
export function loadEnv(rootDir: string): void {
  let raw: string;
  try {
    raw = readFileSync(resolve(rootDir, ".env"), "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export function formatTokens(total: number): string {
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)}M`;
  if (total >= 1000) return `${(total / 1000).toFixed(1)}K`;
  return String(total);
}

export function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}
