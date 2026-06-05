import { buildPresetArgs } from "./writeWorkflowPreset.js";
import { parseArgs } from "./mockContext.js";

const args = buildPresetArgs(["--target-words=1600", "--json"]);
const options = parseArgs(args);

assertEqual(options.command, "write");
assertEqual(options.mockContext, true);
assertEqual(options.json, true);
assertEqual(options.targetWords, 1600);
assertEqual(options.novelTitle, "雾都回声");
assertEqual(options.chapterTitle, "地铁里的第二声");
assertEqual(options.canonFacts.length >= 2, true);
assertEqual(args.includes("--mock-context"), true);

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`断言失败：expected ${String(expected)}, got ${String(actual)}`);
  }
}
