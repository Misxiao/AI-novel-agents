import type { Database } from "better-sqlite3";

import { newId, nowIso } from "./ids.js";
import type { AssetKind, NovelAsset } from "./types.js";

interface AssetRow {
  id: string;
  novel_id: string;
  kind: AssetKind;
  version: number;
  content_json: string;
  status: "active" | "superseded";
  created_at: string;
}

export interface AssetStore {
  /** 保存新版本并将旧 active 版本置为 superseded */
  saveVersion<T>(novelId: string, kind: AssetKind, content: T): NovelAsset<T>;
  getActive<T>(novelId: string, kind: AssetKind): NovelAsset<T> | undefined;
  getVersion<T>(novelId: string, kind: AssetKind, version: number): NovelAsset<T> | undefined;
  listVersions<T>(novelId: string, kind: AssetKind): Array<NovelAsset<T>>;
}

export function createAssetStore(db: Database): AssetStore {
  function toAsset<T>(row: AssetRow): NovelAsset<T> {
    return {
      id: row.id,
      novelId: row.novel_id,
      kind: row.kind,
      version: row.version,
      content: JSON.parse(row.content_json) as T,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  return {
    saveVersion(novelId, kind, content) {
      const save = db.transaction(() => {
        const maxVersion = (
          db
            .prepare(
              "SELECT COALESCE(MAX(version), 0) AS v FROM novel_assets WHERE novel_id = ? AND kind = ?",
            )
            .get(novelId, kind) as { v: number }
        ).v;
        db.prepare(
          "UPDATE novel_assets SET status = 'superseded' WHERE novel_id = ? AND kind = ? AND status = 'active'",
        ).run(novelId, kind);

        const asset = {
          id: newId("asset"),
          novelId,
          kind,
          version: maxVersion + 1,
          content,
          status: "active" as const,
          createdAt: nowIso(),
        };
        db.prepare(
          `INSERT INTO novel_assets (id, novel_id, kind, version, content_json, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          asset.id,
          asset.novelId,
          asset.kind,
          asset.version,
          JSON.stringify(asset.content),
          asset.status,
          asset.createdAt,
        );
        return asset;
      });
      return save();
    },

    getActive(novelId, kind) {
      const row = db
        .prepare(
          "SELECT * FROM novel_assets WHERE novel_id = ? AND kind = ? AND status = 'active'",
        )
        .get(novelId, kind) as AssetRow | undefined;
      return row ? toAsset(row) : undefined;
    },

    getVersion(novelId, kind, version) {
      const row = db
        .prepare(
          "SELECT * FROM novel_assets WHERE novel_id = ? AND kind = ? AND version = ?",
        )
        .get(novelId, kind, version) as AssetRow | undefined;
      return row ? toAsset(row) : undefined;
    },

    listVersions(novelId, kind) {
      const rows = db
        .prepare(
          "SELECT * FROM novel_assets WHERE novel_id = ? AND kind = ? ORDER BY version DESC",
        )
        .all(novelId, kind) as AssetRow[];
      return rows.map((row) => toAsset(row));
    },
  };
}
