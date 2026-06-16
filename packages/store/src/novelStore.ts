import type { Database } from "better-sqlite3";

import { newId, nowIso } from "./ids.js";
import type { Novel, NovelStatus } from "./types.js";

interface NovelRow {
  id: string;
  title: string;
  genre: string | null;
  brief: string | null;
  status: NovelStatus;
  created_at: string;
  updated_at: string;
}

export interface NovelStore {
  create(input: { title: string; genre?: string; brief?: string }): Novel;
  get(id: string): Novel | undefined;
  list(): Novel[];
  update(
    id: string,
    patch: Partial<Pick<Novel, "title" | "genre" | "brief" | "status">>,
  ): Novel;
  /** 级联删除整本小说的全部数据 */
  delete(id: string): void;
}

export function createNovelStore(db: Database): NovelStore {
  function toNovel(row: NovelRow): Novel {
    return {
      id: row.id,
      title: row.title,
      genre: row.genre ?? undefined,
      brief: row.brief ?? undefined,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  return {
    create(input) {
      const novel: Novel = {
        id: newId("novel"),
        title: input.title,
        genre: input.genre,
        brief: input.brief,
        status: "setup",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.prepare(
        `INSERT INTO novels (id, title, genre, brief, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        novel.id,
        novel.title,
        novel.genre ?? null,
        novel.brief ?? null,
        novel.status,
        novel.createdAt,
        novel.updatedAt,
      );
      return novel;
    },

    get(id) {
      const row = db.prepare("SELECT * FROM novels WHERE id = ?").get(id) as
        | NovelRow
        | undefined;
      return row ? toNovel(row) : undefined;
    },

    list() {
      const rows = db
        .prepare("SELECT * FROM novels ORDER BY updated_at DESC")
        .all() as NovelRow[];
      return rows.map(toNovel);
    },

    update(id, patch) {
      const current = this.get(id);
      if (!current) {
        throw new Error(`未找到小说：${id}`);
      }
      const next: Novel = { ...current, ...patch, updatedAt: nowIso() };
      db.prepare(
        `UPDATE novels SET title = ?, genre = ?, brief = ?, status = ?, updated_at = ?
         WHERE id = ?`,
      ).run(next.title, next.genre ?? null, next.brief ?? null, next.status, next.updatedAt, id);
      return next;
    },

    delete(id) {
      const run = db.transaction(() => {
        // 先删通过外键挂在子实体上的孙表
        db.prepare(
          "DELETE FROM chapter_drafts WHERE chapter_id IN (SELECT id FROM chapters WHERE novel_id = ?)",
        ).run(id);
        db.prepare(
          "DELETE FROM character_states WHERE character_id IN (SELECT id FROM characters WHERE novel_id = ?)",
        ).run(id);
        db.prepare(
          "DELETE FROM foreshadow_events WHERE foreshadow_id IN (SELECT id FROM foreshadows WHERE novel_id = ?)",
        ).run(id);
        db.prepare(
          "DELETE FROM workflow_steps WHERE run_id IN (SELECT id FROM workflow_runs WHERE novel_id = ?)",
        ).run(id);
        // 再删直接挂 novel_id 的表
        for (const table of [
          "chapters",
          "characters",
          "foreshadows",
          "workflow_runs",
          "novel_assets",
          "outlines",
          "summaries",
          "canon_facts",
          "agent_runs",
        ]) {
          db.prepare(`DELETE FROM ${table} WHERE novel_id = ?`).run(id);
        }
        db.prepare("DELETE FROM novels WHERE id = ?").run(id);
      });
      run();
    },
  };
}
