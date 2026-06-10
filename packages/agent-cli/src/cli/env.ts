import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";

export function loadLocalEnv(startDir = process.cwd()) {
  const envPath = findNearestFile(startDir, ".env");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  }
}

function findNearestFile(startDir: string, filename: string) {
  let currentDir = resolve(startDir);
  const rootDir = parse(currentDir).root;
  while (true) {
    const candidate = join(currentDir, filename);
    if (existsSync(candidate)) return candidate;
    if (
      existsSync(join(currentDir, "pnpm-workspace.yaml"))
      || currentDir === rootDir
    ) {
      return candidate;
    }
    currentDir = dirname(currentDir);
  }
}
