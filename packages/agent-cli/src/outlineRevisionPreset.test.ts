import {
  buildOutlineRevisionSummary,
  parseOutlineRevisionArgs,
} from "./outlineRevisionPreset.js";

const options = parseOutlineRevisionArgs([
  "--novel-id=novel-cli-revision",
  "--scope=volume",
  "--volume-id=volume-2",
  "--instruction=把第二卷改为营救线",
  "--source-version-id=outline-version-1",
  "--mock",
  "--json",
]);

assertEqual(options.novelId, "novel-cli-revision");
assertEqual(options.scope, "volume");
assertEqual(options.volumeId, "volume-2");
assertEqual(options.instruction, "把第二卷改为营救线");
assertEqual(options.sourceVersionId, "outline-version-1");
assertEqual(options.mock, true);
assertEqual(options.json, true);

const summary = buildOutlineRevisionSummary({
  versionId: "outline-version-2",
  sourceVersionId: "outline-version-1",
  scope: "volume",
  targetVolumeId: "volume-2",
  status: "待确认",
  reviewScore: 91,
  diffSummary: ["第二卷改为营救线"],
  conflicts: [],
  chapterNumberChangeCount: 3,
  agentRunCount: 2,
});

assertOk(summary.includes("outline-version-2"));
assertOk(summary.includes("volume-2"));
assertOk(summary.includes("编号变化: 3"));

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`断言失败：expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertOk(value: unknown) {
  if (!value) {
    throw new Error("断言失败：expected truthy value");
  }
}
