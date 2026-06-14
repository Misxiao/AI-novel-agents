import type { Database } from "better-sqlite3";

import { newId, nowIso } from "./ids.js";
import type {
  Foreshadow,
  ForeshadowEvent,
  ForeshadowEventKind,
  ForeshadowImportance,
  ForeshadowSource,
} from "./types.js";

interface ForeshadowRow {
  id: string;
  novel_id: string;
  title: string;
  description: string;
  importance: ForeshadowImportance;
  status: Foreshadow["status"];
  source: ForeshadowSource;
  planted_chapter_no: number;
  expected_resolve_from: number | null;
  expected_resolve_to: number | null;
  resolved_chapter_no: number | null;
  created_at: string;
  updated_at: string;
}

interface EventRow {
  id: string;
  foreshadow_id: string;
  chapter_no: number;
  event: ForeshadowEventKind;
  note: string | null;
  created_at: string;
}

export interface ForeshadowStore {
  /** 创建伏笔并写入 planted 事件 */
  create(input: {
    novelId: string;
    title: string;
    description: string;
    importance: ForeshadowImportance;
    plantedChapterNo: number;
    source?: ForeshadowSource;
    expectedResolveFrom?: number;
    expectedResolveTo?: number;
  }): Foreshadow;
  get(id: string): Foreshadow | undefined;
  findByTitle(novelId: string, title: string): Foreshadow | undefined;
  list(novelId: string): Foreshadow[];
  /** 未回收的伏笔（planted / advanced） */
  listOpen(novelId: string): Foreshadow[];
  /** 回收窗口已到且未回收的伏笔 */
  listDue(novelId: string, chapterNo: number): Foreshadow[];
  /** 记录推进/回收/废弃事件并联动更新台账状态 */
  recordEvent(foreshadowId: string, chapterNo: number, event: ForeshadowEventKind, note?: string): void;
  listEvents(foreshadowId: string): ForeshadowEvent[];
  update(
    id: string,
    patch: Partial<
      Pick<Foreshadow, "title" | "description" | "importance" | "expectedResolveFrom" | "expectedResolveTo">
    >,
  ): Foreshadow;
}

export function createForeshadowStore(db: Database): ForeshadowStore {
  function toForeshadow(row: ForeshadowRow): Foreshadow {
    return {
      id: row.id,
      novelId: row.novel_id,
      title: row.title,
      description: row.description,
      importance: row.importance,
      status: row.status,
      source: row.source,
      plantedChapterNo: row.planted_chapter_no,
      expectedResolveFrom: row.expected_resolve_from ?? undefined,
      expectedResolveTo: row.expected_resolve_to ?? undefined,
      resolvedChapterNo: row.resolved_chapter_no ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function toEvent(row: EventRow): ForeshadowEvent {
    return {
      id: row.id,
      foreshadowId: row.foreshadow_id,
      chapterNo: row.chapter_no,
      event: row.event,
      note: row.note ?? undefined,
      createdAt: row.created_at,
    };
  }

  function insertEvent(
    foreshadowId: string,
    chapterNo: number,
    event: ForeshadowEventKind,
    note?: string,
  ): void {
    db.prepare(
      `INSERT INTO foreshadow_events (id, foreshadow_id, chapter_no, event, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(newId("fse"), foreshadowId, chapterNo, event, note ?? null, nowIso());
  }

  return {
    create(input) {
      const create = db.transaction(() => {
        const foreshadow: Foreshadow = {
          id: newId("fs"),
          novelId: input.novelId,
          title: input.title,
          description: input.description,
          importance: input.importance,
          status: "planted",
          source: input.source ?? "memory",
          plantedChapterNo: input.plantedChapterNo,
          expectedResolveFrom: input.expectedResolveFrom,
          expectedResolveTo: input.expectedResolveTo,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        db.prepare(
          `INSERT INTO foreshadows
             (id, novel_id, title, description, importance, status, source, planted_chapter_no,
              expected_resolve_from, expected_resolve_to, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          foreshadow.id,
          foreshadow.novelId,
          foreshadow.title,
          foreshadow.description,
          foreshadow.importance,
          foreshadow.status,
          foreshadow.source,
          foreshadow.plantedChapterNo,
          foreshadow.expectedResolveFrom ?? null,
          foreshadow.expectedResolveTo ?? null,
          foreshadow.createdAt,
          foreshadow.updatedAt,
        );
        insertEvent(foreshadow.id, input.plantedChapterNo, "planted");
        return foreshadow;
      });
      return create();
    },

    get(id) {
      const row = db.prepare("SELECT * FROM foreshadows WHERE id = ?").get(id) as
        | ForeshadowRow
        | undefined;
      return row ? toForeshadow(row) : undefined;
    },

    findByTitle(novelId, title) {
      const row = db
        .prepare("SELECT * FROM foreshadows WHERE novel_id = ? AND title = ?")
        .get(novelId, title) as ForeshadowRow | undefined;
      return row ? toForeshadow(row) : undefined;
    },

    list(novelId) {
      const rows = db
        .prepare("SELECT * FROM foreshadows WHERE novel_id = ? ORDER BY planted_chapter_no")
        .all(novelId) as ForeshadowRow[];
      return rows.map(toForeshadow);
    },

    listOpen(novelId) {
      const rows = db
        .prepare(
          `SELECT * FROM foreshadows
           WHERE novel_id = ? AND status IN ('planted', 'advanced')
           ORDER BY planted_chapter_no`,
        )
        .all(novelId) as ForeshadowRow[];
      return rows.map(toForeshadow);
    },

    listDue(novelId, chapterNo) {
      const rows = db
        .prepare(
          `SELECT * FROM foreshadows
           WHERE novel_id = ? AND status IN ('planted', 'advanced')
             AND expected_resolve_from IS NOT NULL AND expected_resolve_from <= ?
           ORDER BY expected_resolve_from`,
        )
        .all(novelId, chapterNo) as ForeshadowRow[];
      return rows.map(toForeshadow);
    },

    recordEvent(foreshadowId, chapterNo, event, note) {
      const record = db.transaction(() => {
        insertEvent(foreshadowId, chapterNo, event, note);
        db.prepare(
          `UPDATE foreshadows
           SET status = ?, resolved_chapter_no = ?, updated_at = ?
           WHERE id = ?`,
        ).run(event, event === "resolved" ? chapterNo : null, nowIso(), foreshadowId);
      });
      record();
    },

    listEvents(foreshadowId) {
      const rows = db
        .prepare(
          "SELECT * FROM foreshadow_events WHERE foreshadow_id = ? ORDER BY chapter_no, created_at",
        )
        .all(foreshadowId) as EventRow[];
      return rows.map(toEvent);
    },

    update(id, patch) {
      const current = this.get(id);
      if (!current) {
        throw new Error(`未找到伏笔：${id}`);
      }
      const next = { ...current, ...patch, updatedAt: nowIso() };
      db.prepare(
        `UPDATE foreshadows
         SET title = ?, description = ?, importance = ?,
             expected_resolve_from = ?, expected_resolve_to = ?, updated_at = ?
         WHERE id = ?`,
      ).run(
        next.title,
        next.description,
        next.importance,
        next.expectedResolveFrom ?? null,
        next.expectedResolveTo ?? null,
        next.updatedAt,
        id,
      );
      return next;
    },
  };
}
