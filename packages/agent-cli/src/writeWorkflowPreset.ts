import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";
import { runWriteNextChapterWorkflow } from "../../workflow/src/index.js";
import {
  DEFAULT_MOCK_CONTEXT_NOVEL_ID,
  createMockContextRepository,
  parseArgs,
} from "./mockContext.js";

const presetArgs = [
  "write",
  "--mock-context",
  "--novel-id=novel-preset-echo",
  "--novel-title=雾都回声",
  "--genre=都市异能",
  "--novel-hook=主角能听见城市里死者留下的回声，但每次回应都会失去一段自己的记忆。",
  "--target-readers=喜欢都市悬疑、异能规则和强反转的读者",
  "--current-volume=第一卷：回声现场",
  "--chapter-no=3",
  "--chapter-title=地铁里的第二声",
  "--chapter-objective=主角确认第二个回声来自同一名凶手，并第一次意识到凶手也能听见回声。",
  "--chapter-hook=他听见自己的名字从隧道深处传来。",
  "--outline-summary=主角在城市凶案现场听见死者回声，追查过程中发现回声规则和自己的失忆代价有关。",
  "--volume-goal=第一卷让主角确认回声规则、找到第一个可信盟友，并揭开地铁旧案背后的连环凶手。",
  "--previous-summary=主角在废弃天桥下听见第一段死者回声，确认那不是幻觉，而是一段被困在现场的临终信息。",
  "--next-objective=主角追查地铁站旧案，并发现旧案卷宗被人提前调走。",
  "--canon-fact=主角已经听见过第一段死者回声。",
  "--canon-fact=回声只能在案发地点附近出现。",
  "--canon-fact=主角回应回声后，会短暂遗忘一个与自己有关的细节。",
  "--world-rule=回声不会直接说出凶手姓名，只能重复死者临终前感知到的声音、气味或画面。",
  "--world-rule=同一处现场不会无故出现两段互相矛盾的回声。",
  "--style-guidance=短段落，冷硬，动作优先。",
  "--style-guidance=少解释规则，把规则变成眼前麻烦。",
  "--forbidden-expression=命运的齿轮开始转动",
  "--forbidden-expression=一切都还没有结束",
  "--intent=这一章要更悬疑，主角要主动试探回声，章末必须留下强追读钩子。",
  "--target-words=2200",
];

export function buildPresetArgs(userArgs: string[]) {
  return [...userArgs, ...presetArgs.filter((arg) => shouldAppendDefault(userArgs, arg))];
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(buildPresetArgs(process.argv.slice(2)));
  const result = await runWriteNextChapterWorkflow({
    novelId: options.novelId ?? DEFAULT_MOCK_CONTEXT_NOVEL_ID,
    chapterNo: options.chapterNo,
    authorIntent: options.intent,
    targetWords: options.targetWords,
    repository: createMockContextRepository(options),
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printResult(result);
}

function shouldAppendDefault(userArgs: string[], defaultArg: string) {
  if (!defaultArg.startsWith("--")) {
    return !userArgs.some((arg) => !arg.startsWith("--"));
  }

  const key = defaultArg.includes("=") ? defaultArg.slice(0, defaultArg.indexOf("=")) : defaultArg;
  return !userArgs.some((arg) => arg === key || arg.startsWith(`${key}=`));
}

function printResult(result: Awaited<ReturnType<typeof runWriteNextChapterWorkflow>>) {
  console.log("\n[workflow.writeNextChapter:preset]");
  console.log(`chapterPlan: 第 ${result.chapterPlan.chapterNo} 章《${result.chapterPlan.title}》`);
  console.log(`provider/model: ${result.finalDraft.provider} / ${result.finalDraft.model}`);
  console.log(`wordCount: ${result.finalDraft.wordCount}`);
  console.log(`qualityGate: ${result.qualityGate.passed ? "通过" : "未通过"} / ${result.qualityGate.score}/${result.qualityGate.threshold} / 修订 ${result.qualityGate.revisionRounds} 轮`);
  if (result.qualityGate.unresolvedCriticalIssues.length > 0) {
    console.log(`criticalIssues: ${result.qualityGate.unresolvedCriticalIssues.join("；")}`);
  }
  if (result.finalDraft.warnings.length > 0) {
    console.log(`warnings: ${result.finalDraft.warnings.join("；")}`);
  }

  console.log("\n评审摘要：");
  console.log(result.reviewReports.at(-1)?.summary ?? "无");
  console.log("\n章节摘要：");
  console.log(result.finalDraft.summary);
  console.log("\n正文：");
  console.log(result.finalDraft.content);
}

function loadLocalEnv() {
  const envPath = findNearestFile(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

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
    if (existsSync(candidate)) {
      return candidate;
    }

    if (existsSync(join(currentDir, "pnpm-workspace.yaml")) || currentDir === rootDir) {
      return candidate;
    }

    currentDir = dirname(currentDir);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
