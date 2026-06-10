import { NovelDatabase } from "./index.js";

const dbPath = `/private/tmp/ai-novel-agents-preflight-db-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const db = new NovelDatabase(dbPath);

testCreatesEmptyNovel();
testStoresPreflightAssetsByNovel();

function testCreatesEmptyNovel() {
  const novel = db.createEmptyNovel();

  assertOk(novel.novelId.startsWith("novel-"));
  assertEqual(novel.title, "");
  assertEqual(novel.genre, "");
  assertEqual(novel.hook, "");
  assertEqual(novel.targetWords, 0);
  assertEqual(novel.totalChapters, 0);
  assertEqual(novel.stage, "立项");
}

function testStoresPreflightAssetsByNovel() {
  const first = db.createEmptyNovel();
  const second = db.createEmptyNovel();

  db.savePreflightAsset({
    novelId: first.novelId,
    kind: "foundation",
    status: "待确认",
    asset: { novelId: first.novelId, hook: "第一本书" },
  });
  db.savePreflightAsset({
    novelId: second.novelId,
    kind: "foundation",
    status: "草稿",
    asset: { novelId: second.novelId, hook: "第二本书" },
  });

  const firstAsset = db.getPreflightAsset<{ novelId: string; hook: string }>(
    first.novelId,
    "foundation",
  );
  const secondAsset = db.getPreflightAsset<{ novelId: string; hook: string }>(
    second.novelId,
    "foundation",
  );

  assertEqual(firstAsset?.status, "待确认");
  assertEqual(firstAsset?.asset.hook, "第一本书");
  assertEqual(secondAsset?.status, "草稿");
  assertEqual(secondAsset?.asset.hook, "第二本书");
}

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
