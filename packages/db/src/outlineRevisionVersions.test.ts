import { NovelDatabase } from "./index.js";

const dbPath = `/private/tmp/ai-novel-agents-outline-versions-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const db = new NovelDatabase(dbPath);
const firstNovel = db.createEmptyNovel();
const secondNovel = db.createEmptyNovel();

db.saveOutlineRevisionVersion({
  novelId: firstNovel.novelId,
  versionId: "outline-version-1",
  sourceVersionId: undefined,
  status: "待确认",
  scope: "master",
  version: { revisedOutline: { novelId: firstNovel.novelId, marker: "v1" } },
  createdAt: "2026-06-05T00:00:00.000Z",
});
db.saveOutlineRevisionVersion({
  novelId: firstNovel.novelId,
  versionId: "outline-version-2",
  sourceVersionId: "outline-version-1",
  status: "需修订",
  scope: "volume",
  targetVolumeId: "volume-1",
  version: { revisedOutline: { novelId: firstNovel.novelId, marker: "v2" } },
  createdAt: "2026-06-05T01:00:00.000Z",
});
db.saveOutlineRevisionVersion({
  novelId: secondNovel.novelId,
  versionId: "outline-version-other",
  status: "待确认",
  scope: "master",
  version: { revisedOutline: { novelId: secondNovel.novelId, marker: "other" } },
  createdAt: "2026-06-05T02:00:00.000Z",
});

assertEqual(
  db.getOutlineRevisionVersion<{ revisedOutline: { marker: string } }>(
    firstNovel.novelId,
    "outline-version-1",
  )?.version.revisedOutline.marker,
  "v1",
);
assertEqual(
  db.listOutlineRevisionVersions<{ revisedOutline: { marker: string } }>(
    firstNovel.novelId,
  ).map((item) => item.versionId).join(","),
  "outline-version-2,outline-version-1",
);
assertEqual(
  db.getLatestOutlineRevisionVersion<{ revisedOutline: { marker: string } }>(
    firstNovel.novelId,
  )?.version.revisedOutline.marker,
  "v2",
);
assertEqual(db.listOutlineRevisionVersions(secondNovel.novelId).length, 1);

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`断言失败：expected ${String(expected)}, got ${String(actual)}`);
  }
}
