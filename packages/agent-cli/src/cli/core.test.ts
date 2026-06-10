import { parseCommandArgs, tokenizeCommandLine } from "./parser.js";
import { CommandRegistry } from "./registry.js";
import type { CommandDefinition } from "./types.js";

testTokenizesQuotedChineseAndEscapes();
testParsesOptionsAndPositionals();
testRejectsUnclosedQuote();
testRegistryResolvesLongestCommandPath();
testHelpComesFromRegistry();

function testTokenizesQuotedChineseAndEscapes() {
  assertDeepEqual(
    tokenizeCommandLine('preflight run --seed-notes "主角说\\"别回头\\"" --mock'),
    ["preflight", "run", "--seed-notes", '主角说"别回头"', "--mock"],
  );
}

function testParsesOptionsAndPositionals() {
  const parsed = parseCommandArgs([
    "outline",
    "revise-volume",
    "volume-2",
    "--instruction=延后真相",
    "--tag",
    "悬疑",
    "--tag=成长",
    "--mock",
  ]);

  assertDeepEqual(parsed.path, []);
  assertDeepEqual(parsed.positionals, ["outline", "revise-volume", "volume-2"]);
  assertDeepEqual(parsed.options, {
    instruction: "延后真相",
    tag: ["悬疑", "成长"],
    mock: true,
  });
}

function testRejectsUnclosedQuote() {
  assertThrows(
    () => tokenizeCommandLine('novel update --title "未结束'),
    "命令中存在未闭合的引号。",
  );
}

function testRegistryResolvesLongestCommandPath() {
  const registry = new CommandRegistry([
    command(["outline"], "大纲命令"),
    command(["outline", "show"], "查看大纲"),
  ]);
  const resolved = registry.resolve(["outline", "show", "--json"]);

  assertDeepEqual(resolved?.definition.path, ["outline", "show"]);
  assertDeepEqual(resolved?.args, ["--json"]);
}

function testHelpComesFromRegistry() {
  const registry = new CommandRegistry([
    command(["novel", "list"], "查看小说列表", "novel list [--json]", ["novel list"]),
    command(["novel", "create"], "创建空小说", "novel create [--json]", ["novel create"]),
    command(["outline", "show"], "查看当前大纲"),
    command(["asset", "show"], "查看前置资产草案"),
    command(["context"], "查看当前小说和数据库位置"),
    command(["help"], "查看命令说明"),
    command(["exit"], "退出工作台"),
    command(["quit"], "退出工作台"),
    command(["custom", "run"], "运行自定义命令"),
  ]);

  const rootHelp = registry.buildHelp();
  const groupHelp = registry.buildHelp(["novel"]);
  const commandHelp = registry.buildHelp(["novel", "list"]);
  const fallbackHelp = registry.buildHelp(["custom"]);

  assertOk(rootHelp.includes("创作命令:"));
  assertOk(rootHelp.includes("查询命令:"));
  assertOk(rootHelp.includes("工作台命令:"));
  assertOk(rootHelp.includes("创建、查看和管理小说项目"));
  assertOk(!rootHelp.includes("个命令"));
  assertOk(!rootHelp.includes("  quit"));
  assertOk(rootHelp.includes("novel"));
  assertOk(rootHelp.includes("outline"));
  assertOk(groupHelp.includes("novel - 创建、查看和管理小说项目"));
  assertOk(groupHelp.includes("可用子命令:"));
  assertOk(groupHelp.includes("novel list"));
  assertOk(groupHelp.includes("novel create"));
  assertOk(groupHelp.includes("输入 help novel <子命令> 查看详细说明。"));
  assertOk(fallbackHelp.includes("custom 命令:"));
  assertOk(fallbackHelp.includes("custom run"));
  assertOk(commandHelp.includes("查看小说列表"));
  assertOk(commandHelp.includes("用法: novel list [--json]"));
  assertOk(commandHelp.includes("示例:"));
}

function command(
  path: string[],
  summary: string,
  usage = path.join(" "),
  examples = [path.join(" ")],
): CommandDefinition {
  return {
    path,
    summary,
    usage,
    examples,
    allowedOptions: Array.from(
      usage.matchAll(/--([a-z0-9-]+)/gi),
      (match) => match[1]!,
    ),
    maxPositionals: 0,
    async execute() {
      return { exitCode: 0 };
    },
  };
}

function assertDeepEqual(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`断言失败：expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertOk(value: unknown) {
  if (!value) {
    throw new Error("断言失败：expected truthy value");
  }
}

function assertThrows(action: () => unknown, expectedMessage: string) {
  try {
    action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === expectedMessage) return;
    throw new Error(`断言失败：expected ${expectedMessage}, got ${message}`);
  }
  throw new Error(`断言失败：expected throw ${expectedMessage}`);
}
