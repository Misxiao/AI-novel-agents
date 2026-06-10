import { NovelDatabase } from "../../db/src/index.js";
import { NovelPreflightRepository } from "./index.js";

const dbPath = `/private/tmp/ai-novel-agents-preflight-repository-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const repository = new NovelPreflightRepository(new NovelDatabase(dbPath));

const novel = repository.createEmptyNovel();
repository.saveDraft({
  novelId: novel.novelId,
  kind: "setting",
  status: "待确认",
  asset: {
    novelId: novel.novelId,
    background: "灵气枯竭后的修真世界",
  },
});

const loaded = repository.getDraft<{ novelId: string; background: string }>(
  novel.novelId,
  "setting",
);

assertEqual(loaded?.asset.novelId, novel.novelId);
assertEqual(loaded?.asset.background, "灵气枯竭后的修真世界");

repository.saveOutlineVersion({
  novelId: novel.novelId,
  versionId: "outline-version-repository",
  status: "待确认",
  scope: "master",
  version: {
    revisedOutline: {
      novelId: novel.novelId,
      volumes: [],
      chapterPlans: [],
    },
  },
  createdAt: "2026-06-05T00:00:00.000Z",
});

assertEqual(
  repository.getLatestOutlineVersion<{ revisedOutline: { novelId: string } }>(
    novel.novelId,
  )?.version.revisedOutline.novelId,
  novel.novelId,
);

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`断言失败：expected ${String(expected)}, got ${String(actual)}`);
  }
}
