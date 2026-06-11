import type { Database } from "better-sqlite3";

import { newId, nowIso } from "./ids.js";
import type { MainOutline, Outline, OutlineScope, VolumeOutline } from "./types.js";

interface OutlineRow {
  id: string;
  novel_id: string;
  scope: OutlineScope;
  volume_no: number | null;
  version: number;
  content_json: string;
  status: "active" | "superseded";
  revision_note: string | null;
  created_at: string;
}

export interface OutlineStore {
  /** 保存新版本并将同 scope/卷的旧 active 版本置为 superseded */
  saveVersion<T>(input: {
    novelId: string;
    scope: OutlineScope;
    volumeNo?: number;
    content: T;
    revisionNote?: string;
  }): Outline<T>;
  getActiveMain(novelId: string): Outline<MainOutline> | undefined;
  getActiveVolume(novelId: string, volumeNo: number): Outline<VolumeOutline> | undefined;
  listActiveVolumes(novelId: string): Array<Outline<VolumeOutline>>;
  listVersions(novelId: string, scope: OutlineScope, volumeNo?: number): Array<Outline>;
}

export function createOutlineStore(db: Database): OutlineStore {
  function toOutline<T>(row: OutlineRow): Outline<T> {
    return {
      id: row.id,
      novelId: row.novel_id,
      scope: row.scope,
      volumeNo: row.volume_no ?? undefined,
      version: row.version,
      content: JSON.parse(row.content_json) as T,
      status: row.status,
      revisionNote: row.revision_note ?? undefined,
      createdAt: row.created_at,
    };
  }

  return {
    saveVersion({ novelId, scope, volumeNo, content, revisionNote }) {
      const save = db.transaction(() => {
        const maxVersion = (
          db
            .prepare(
              `SELECT COALESCE(MAX(version), 0) AS v FROM outlines
               WHERE novel_id = ? AND scope = ? AND volume_no IS ?`,
            )
            .get(novelId, scope, volumeNo ?? null) as { v: number }
        ).v;
        db.prepare(
          `UPDATE outlines SET status = 'superseded'
           WHERE novel_id = ? AND scope = ? AND volume_no IS ? AND status = 'active'`,
        ).run(novelId, scope, volumeNo ?? null);

        const outline = {
          id: newId("outline"),
          novelId,
          scope,
          volumeNo,
          version: maxVersion + 1,
          content,
          status: "active" as const,
          revisionNote,
          createdAt: nowIso(),
        };
        db.prepare(
          `INSERT INTO outlines
             (id, novel_id, scope, volume_no, version, content_json, status, revision_note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          outline.id,
          outline.novelId,
          outline.scope,
          outline.volumeNo ?? null,
          outline.version,
          JSON.stringify(outline.content),
          outline.status,
          outline.revisionNote ?? null,
          outline.createdAt,
        );
        return outline;
      });
      return save();
    },

    getActiveMain(novelId) {
      const row = db
        .prepare(
          "SELECT * FROM outlines WHERE novel_id = ? AND scope = 'main' AND status = 'active'",
        )
        .get(novelId) as OutlineRow | undefined;
      return row ? toOutline<MainOutline>(row) : undefined;
    },

    getActiveVolume(novelId, volumeNo) {
      const row = db
        .prepare(
          `SELECT * FROM outlines
           WHERE novel_id = ? AND scope = 'volume' AND volume_no = ? AND status = 'active'`,
        )
        .get(novelId, volumeNo) as OutlineRow | undefined;
      return row ? toOutline<VolumeOutline>(row) : undefined;
    },

    listActiveVolumes(novelId) {
      const rows = db
        .prepare(
          `SELECT * FROM outlines
           WHERE novel_id = ? AND scope = 'volume' AND status = 'active'
           ORDER BY volume_no`,
        )
        .all(novelId) as OutlineRow[];
      return rows.map((row) => toOutline<VolumeOutline>(row));
    },

    listVersions(novelId, scope, volumeNo) {
      const rows = db
        .prepare(
          `SELECT * FROM outlines
           WHERE novel_id = ? AND scope = ? AND volume_no IS ?
           ORDER BY version DESC`,
        )
        .all(novelId, scope, volumeNo ?? null) as OutlineRow[];
      return rows.map((row) => toOutline(row));
    },
  };
}
