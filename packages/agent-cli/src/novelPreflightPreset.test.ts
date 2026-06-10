import {
  buildNovelPreflightSummary,
  parseNovelPreflightArgs,
} from "./novelPreflightPreset.js";

const options = parseNovelPreflightArgs([
  "--novel-id=novel-cli-test",
  "--seed-notes=主角死亡后回到三日前",
  "--target-words=360000",
  "--chapter-plans=12",
  "--mock",
  "--json",
]);

assertEqual(options.novelId, "novel-cli-test");
assertEqual(options.seedNotes, "主角死亡后回到三日前");
assertEqual(options.targetWords, 360000);
assertEqual(options.chapterPlanCount, 12);
assertEqual(options.mock, true);
assertEqual(options.json, true);

const summary = buildNovelPreflightSummary({
  novelId: "novel-cli-test",
  titleCandidates: ["三日前死局"],
  synopsis: "一段简介",
  volumeCount: 4,
  chapterPlanCount: 12,
  reviewScores: {
    foundation: 88,
    setting: 86,
    outline: 90,
  },
  risks: ["伏笔回收窗口需要确认"],
  agentRunCount: 6,
});

assertOk(summary.includes("三日前死局"));
assertOk(summary.includes("12"));
assertOk(summary.includes("伏笔回收窗口需要确认"));

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
