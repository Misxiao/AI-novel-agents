import type { Database } from "better-sqlite3";

import { newId, nowIso } from "./ids.js";
import type { CanonCategory, CanonFact } from "./types.js";

interface CanonRow {
  id: string;
  novel_id: string;
  category: CanonCategory;
  subject: string;
  fact: string;
  established_chapter_no: number;
  status: "active" | "retconned";
  created_at: string;
}

export interface CanonStore {
  add(input: {
    novelId: string;
    category: CanonCategory;
    subject: string;
    fact: string;
    establishedChapterNo: number;
  }): CanonFact;
  list(novelId: string, options?: { subjects?: string[]; includeRetconned?: boolean }): CanonFact[];
  update(id: string, patch: Partial<Pick<CanonFact, "subject" | "fact" | "category">>): void;
  /** 撤销既成事实（标记为 retconned，不删除） */
  retcon(id: string): void;
  remove(id: string): void;
}

export function createCanonStore(db: Database): CanonStore {
  function toFact(row: CanonRow): CanonFact {
    return {
      id: row.id,
      novelId: row.novel_id,
      category: row.category,
      subject: row.subject,
      fact: row.fact,
      establishedChapterNo: row.established_chapter_no,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  return {
    add(input) {
      const fact: CanonFact = {
        id: newId("canon"),
        novelId: input.novelId,
        category: input.category,
        subject: input.subject,
        fact: input.fact,
        establishedChapterNo: input.establishedChapterNo,
        status: "active",
        createdAt: nowIso(),
      };
      db.prepare(
        `INSERT INTO canon_facts (id, novel_id, category, subject, fact, established_chapter_no, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        fact.id,
        fact.novelId,
        fact.category,
        fact.subject,
        fact.fact,
        fact.establishedChapterNo,
        fact.status,
        fact.createdAt,
      );
      return fact;
    },

    list(novelId, options = {}) {
      const rows = db
        .prepare(
          "SELECT * FROM canon_facts WHERE novel_id = ? ORDER BY established_chapter_no, created_at",
        )
        .all(novelId) as CanonRow[];
      return rows
        .map(toFact)
        .filter((fact) => options.includeRetconned || fact.status === "active")
        .filter(
          (fact) => !options.subjects || options.subjects.includes(fact.subject),
        );
    },

    update(id, patch) {
      const row = db.prepare("SELECT * FROM canon_facts WHERE id = ?").get(id) as
        | CanonRow
        | undefined;
      if (!row) {
        throw new Error(`未找到 canon 事实：${id}`);
      }
      db.prepare("UPDATE canon_facts SET category = ?, subject = ?, fact = ? WHERE id = ?").run(
        patch.category ?? row.category,
        patch.subject ?? row.subject,
        patch.fact ?? row.fact,
        id,
      );
    },

    retcon(id) {
      db.prepare("UPDATE canon_facts SET status = 'retconned' WHERE id = ?").run(id);
    },

    remove(id) {
      db.prepare("DELETE FROM canon_facts WHERE id = ?").run(id);
    },
  };
}
