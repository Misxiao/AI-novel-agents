import type { Database } from "better-sqlite3";

import { newId, nowIso } from "./ids.js";
import type { Summary, SummaryLevel } from "./types.js";

interface SummaryRow {
  id: string;
  novel_id: string;
  level: SummaryLevel;
  ref_no: number | null;
  content: string;
  covers_to_chapter: number | null;
  created_at: string;
  updated_at: string;
}

export interface SummaryStore {
  upsert(input: {
    novelId: string;
    level: SummaryLevel;
    refNo?: number;
    content: string;
    coversToChapter?: number;
  }): Summary;
  get(novelId: string, level: SummaryLevel, refNo?: number): Summary | undefined;
  /** [fromNo, toNo] 范围内的章摘要，按章号升序 */
  listChapterSummaries(novelId: string, fromNo: number, toNo: number): Summary[];
  listVolumeSummaries(novelId: string): Summary[];
  remove(novelId: string, level: SummaryLevel, refNo?: number): void;
}

export function createSummaryStore(db: Database): SummaryStore {
  function toSummary(row: SummaryRow): Summary {
    return {
      id: row.id,
      novelId: row.novel_id,
      level: row.level,
      refNo: row.ref_no ?? undefined,
      content: row.content,
      coversToChapter: row.covers_to_chapter ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  return {
    upsert(input) {
      const existing = this.get(input.novelId, input.level, input.refNo);
      if (existing) {
        const next: Summary = {
          ...existing,
          content: input.content,
          coversToChapter: input.coversToChapter,
          updatedAt: nowIso(),
        };
        db.prepare(
          "UPDATE summaries SET content = ?, covers_to_chapter = ?, updated_at = ? WHERE id = ?",
        ).run(next.content, next.coversToChapter ?? null, next.updatedAt, next.id);
        return next;
      }
      const summary: Summary = {
        id: newId("sum"),
        novelId: input.novelId,
        level: input.level,
        refNo: input.refNo,
        content: input.content,
        coversToChapter: input.coversToChapter,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.prepare(
        `INSERT INTO summaries (id, novel_id, level, ref_no, content, covers_to_chapter, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        summary.id,
        summary.novelId,
        summary.level,
        summary.refNo ?? null,
        summary.content,
        summary.coversToChapter ?? null,
        summary.createdAt,
        summary.updatedAt,
      );
      return summary;
    },

    get(novelId, level, refNo) {
      const row = db
        .prepare("SELECT * FROM summaries WHERE novel_id = ? AND level = ? AND ref_no IS ?")
        .get(novelId, level, refNo ?? null) as SummaryRow | undefined;
      return row ? toSummary(row) : undefined;
    },

    listChapterSummaries(novelId, fromNo, toNo) {
      const rows = db
        .prepare(
          `SELECT * FROM summaries
           WHERE novel_id = ? AND level = 'chapter' AND ref_no BETWEEN ? AND ?
           ORDER BY ref_no`,
        )
        .all(novelId, fromNo, toNo) as SummaryRow[];
      return rows.map(toSummary);
    },

    listVolumeSummaries(novelId) {
      const rows = db
        .prepare(
          "SELECT * FROM summaries WHERE novel_id = ? AND level = 'volume' ORDER BY ref_no",
        )
        .all(novelId) as SummaryRow[];
      return rows.map(toSummary);
    },

    remove(novelId, level, refNo) {
      db.prepare("DELETE FROM summaries WHERE novel_id = ? AND level = ? AND ref_no IS ?").run(
        novelId,
        level,
        refNo ?? null,
      );
    },
  };
}
