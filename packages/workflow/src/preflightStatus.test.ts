import { resolvePreflightAssetStatus } from "./novelPreflight.js";

assertEqual(resolvePreflightAssetStatus({
  passed: true,
  overallScore: 88,
  issues: [],
}), "待确认");

assertEqual(resolvePreflightAssetStatus({
  passed: false,
  overallScore: 88,
  issues: [],
}), "需修订");

assertEqual(resolvePreflightAssetStatus({
  passed: true,
  overallScore: 84,
  issues: [],
}), "需修订");

assertEqual(resolvePreflightAssetStatus({
  passed: true,
  overallScore: 90,
  issues: [{ severity: "critical" }],
}), "需修订");

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`断言失败：expected ${String(expected)}, got ${String(actual)}`);
  }
}
