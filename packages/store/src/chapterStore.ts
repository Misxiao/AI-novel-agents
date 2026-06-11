import type { Database } from "better-sqlite3";

import { newId, nowIso } from "./ids.js";
import type {
  Chapter,
  ChapterDraft,
  ChapterPlan,
  ChapterStatus,
  DraftReview,
  DraftSource,
} from "./types.js";

interface ChapterRow {
  id: string;
  novel_id: string;
  volume_no: number;
  chapter_no: number;
  title: string | null;
  status: ChapterStatus;
  plan_json: string | null;
  confirmed_draft_id: string | null;
  created_at: string;
  updated_at: string;
}

interface DraftRow {
  id: string;
  chapter_id: string;
  version: number;
  content: string;
  word_count: number;
  source: DraftSource;
  review_json: string | null;
  created_at: string;
}

export interface ChapterStore {
  /** 取出或创建 planned 状态的章节记录 */
  ensure(novelId: string, volumeNo: number, chapterNo: number): Chapter;
  get(novelId: string, chapterNo: number): Chapter | undefined;
  getById(id: string): Chapter | undefined;
  list(novelId: string): Chapter[];
  listByStatus(novelId: string, status: ChapterStatus): Chapter[];
  setPlan(chapterId: string, plan: ChapterPlan): void;
  setStatus(chapterId: string, status: ChapterStatus): void;
  setConfirmedDraft(chapterId: string, draftId: string): void;
  /** 下一个未确认章号（已确认的最大章号 + 1） */
  nextChapterNo(novelId: string): number;
  maxConfirmedChapterNo(novelId: string): number;

  addDraft(chapterId: string, input: { content: string; source: DraftSource }): ChapterDraft;
  getDraft(draftId: string): ChapterDraft | undefined;
  listDrafts(chapterId: string): ChapterDraft[];
  latestDraft(chapterId: string): ChapterDraft | undefined;
  setDraftReview(draftId: string, review: DraftReview): void;
}

export function countWords(content: string): number {
  return content.replace(/\s/g, "").length;
}

export function createChapterStore(db: Database): ChapterStore {
  function toChapter(row: ChapterRow): Chapter {
    return {
      id: row.id,
      novelId: row.novel_id,
      volumeNo: row.volume_no,
      chapterNo: row.chapter_no,
      title: row.title ?? undefined,
      status: row.status,
      plan: row.plan_json ? (JSON.parse(row.plan_json) as ChapterPlan) : undefined,
      confirmedDraftId: row.confirmed_draft_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function toDraft(row: DraftRow): ChapterDraft {
    return {
      id: row.id,
      chapterId: row.chapter_id,
      version: row.version,
      content: row.content,
      wordCount: row.word_count,
      source: row.source,
      review: row.review_json ? (JSON.parse(row.review_json) as DraftReview) : undefined,
      createdAt: row.created_at,
    };
  }

  function touch(chapterId: string): void {
    db.prepare("UPDATE chapters SET updated_at = ? WHERE id = ?").run(nowIso(), chapterId);
  }

  return {
    ensure(novelId, volumeNo, chapterNo) {
      const existing = this.get(novelId, chapterNo);
      if (existing) {
        return existing;
      }
      const chapter: Chapter = {
        id: newId("ch"),
        novelId,
        volumeNo,
        chapterNo,
        status: "planned",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.prepare(
        `INSERT INTO chapters (id, novel_id, volume_no, chapter_no, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        chapter.id,
        chapter.novelId,
        chapter.volumeNo,
        chapter.chapterNo,
        chapter.status,
        chapter.createdAt,
        chapter.updatedAt,
      );
      return chapter;
    },

    get(novelId, chapterNo) {
      const row = db
        .prepare("SELECT * FROM chapters WHERE novel_id = ? AND chapter_no = ?")
        .get(novelId, chapterNo) as ChapterRow | undefined;
      return row ? toChapter(row) : undefined;
    },

    getById(id) {
      const row = db.prepare("SELECT * FROM chapters WHERE id = ?").get(id) as
        | ChapterRow
        | undefined;
      return row ? toChapter(row) : undefined;
    },

    list(novelId) {
      const rows = db
        .prepare("SELECT * FROM chapters WHERE novel_id = ? ORDER BY chapter_no")
        .all(novelId) as ChapterRow[];
      return rows.map(toChapter);
    },

    listByStatus(novelId, status) {
      const rows = db
        .prepare("SELECT * FROM chapters WHERE novel_id = ? AND status = ? ORDER BY chapter_no")
        .all(novelId, status) as ChapterRow[];
      return rows.map(toChapter);
    },

    setPlan(chapterId, plan) {
      db.prepare("UPDATE chapters SET plan_json = ?, title = ?, updated_at = ? WHERE id = ?").run(
        JSON.stringify(plan),
        plan.title,
        nowIso(),
        chapterId,
      );
    },

    setStatus(chapterId, status) {
      db.prepare("UPDATE chapters SET status = ?, updated_at = ? WHERE id = ?").run(
        status,
        nowIso(),
        chapterId,
      );
    },

    setConfirmedDraft(chapterId, draftId) {
      db.prepare(
        "UPDATE chapters SET confirmed_draft_id = ?, status = 'confirmed', updated_at = ? WHERE id = ?",
      ).run(draftId, nowIso(), chapterId);
    },

    nextChapterNo(novelId) {
      return this.maxConfirmedChapterNo(novelId) + 1;
    },

    maxConfirmedChapterNo(novelId) {
      return (
        db
          .prepare(
            "SELECT COALESCE(MAX(chapter_no), 0) AS n FROM chapters WHERE novel_id = ? AND status = 'confirmed'",
          )
          .get(novelId) as { n: number }
      ).n;
    },

    addDraft(chapterId, input) {
      const version =
        (
          db
            .prepare("SELECT COALESCE(MAX(version), 0) AS v FROM chapter_drafts WHERE chapter_id = ?")
            .get(chapterId) as { v: number }
        ).v + 1;
      const draft: ChapterDraft = {
        id: newId("draft"),
        chapterId,
        version,
        content: input.content,
        wordCount: countWords(input.content),
        source: input.source,
        createdAt: nowIso(),
      };
      db.prepare(
        `INSERT INTO chapter_drafts (id, chapter_id, version, content, word_count, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        draft.id,
        draft.chapterId,
        draft.version,
        draft.content,
        draft.wordCount,
        draft.source,
        draft.createdAt,
      );
      touch(chapterId);
      return draft;
    },

    getDraft(draftId) {
      const row = db.prepare("SELECT * FROM chapter_drafts WHERE id = ?").get(draftId) as
        | DraftRow
        | undefined;
      return row ? toDraft(row) : undefined;
    },

    listDrafts(chapterId) {
      const rows = db
        .prepare("SELECT * FROM chapter_drafts WHERE chapter_id = ? ORDER BY version")
        .all(chapterId) as DraftRow[];
      return rows.map(toDraft);
    },

    latestDraft(chapterId) {
      const row = db
        .prepare("SELECT * FROM chapter_drafts WHERE chapter_id = ? ORDER BY version DESC LIMIT 1")
        .get(chapterId) as DraftRow | undefined;
      return row ? toDraft(row) : undefined;
    },

    setDraftReview(draftId, review) {
      db.prepare("UPDATE chapter_drafts SET review_json = ? WHERE id = ?").run(
        JSON.stringify(review),
        draftId,
      );
    },
  };
}
