import type { Database } from "better-sqlite3";

import type { CharacterStore } from "./characterStore.js";
import type { ForeshadowStore } from "./foreshadowStore.js";
import type { SummaryStore } from "./summaryStore.js";
import type { CanonStore } from "./canonStore.js";
import { nowIso } from "./ids.js";
import type { ChapterMemory, ForeshadowEventKind } from "./types.js";

export interface MemoryStores {
  characters: CharacterStore;
  foreshadows: ForeshadowStore;
  summaries: SummaryStore;
  canon: CanonStore;
}

export interface MemoryTransaction {
  /** 章节确认时：把提取的记忆写入各台账（一个事务） */
  applyChapterMemory(novelId: string, chapterNo: number, memory: ChapterMemory): void;
  /** 已确认章重新修订时：回滚该章写入的全部记忆（一个事务） */
  rollbackChapterMemory(novelId: string, chapterNo: number): void;
}

export function createMemoryTransaction(db: Database, stores: MemoryStores): MemoryTransaction {
  function applyCharacterStates(
    novelId: string,
    chapterNo: number,
    states: ChapterMemory["characterStates"],
  ): void {
    for (const state of states) {
      const character =
        stores.characters.getByName(novelId, state.name) ??
        stores.characters.upsert({
          novelId,
          name: state.name,
          role: "minor",
          profile: {
            identity: "正文中新出场，档案待补",
            personality: "",
            background: "",
            want: state.goal ?? "",
          },
          firstChapterNo: chapterNo,
        });
      stores.characters.addState(character.id, chapterNo, {
        goal: state.goal,
        emotion: state.emotion,
        relationships: state.relationships,
        physical: state.physical,
        knowledge: state.knowledge,
        changeNote: state.changeNote,
      });
    }
  }

  return {
    applyChapterMemory(novelId, chapterNo, memory) {
      const apply = db.transaction(() => {
        applyCharacterStates(novelId, chapterNo, memory.characterStates);

        for (const event of memory.foreshadowEvents) {
          stores.foreshadows.recordEvent(
            event.foreshadowId,
            chapterNo,
            event.event,
            event.note,
          );
        }

        for (const seed of memory.newForeshadows) {
          stores.foreshadows.create({
            novelId,
            title: seed.title,
            description: seed.description,
            importance: seed.importance,
            plantedChapterNo: chapterNo,
            expectedResolveFrom: seed.expectedResolveFrom,
            expectedResolveTo: seed.expectedResolveTo,
          });
        }

        for (const fact of memory.canonFacts) {
          stores.canon.add({
            novelId,
            category: fact.category,
            subject: fact.subject,
            fact: fact.fact,
            establishedChapterNo: chapterNo,
          });
        }

        stores.summaries.upsert({
          novelId,
          level: "chapter",
          refNo: chapterNo,
          content: memory.summary,
        });
      });
      apply();
    },

    rollbackChapterMemory(novelId, chapterNo) {
      const rollback = db.transaction(() => {
        db.prepare(
          `DELETE FROM character_states
           WHERE chapter_no = ?
             AND character_id IN (SELECT id FROM characters WHERE novel_id = ?)`,
        ).run(chapterNo, novelId);

        // 本章新埋的伏笔整体删除（含事件）
        const planted = db
          .prepare(
            "SELECT id FROM foreshadows WHERE novel_id = ? AND planted_chapter_no = ?",
          )
          .all(novelId, chapterNo) as Array<{ id: string }>;
        for (const { id } of planted) {
          db.prepare("DELETE FROM foreshadow_events WHERE foreshadow_id = ?").run(id);
          db.prepare("DELETE FROM foreshadows WHERE id = ?").run(id);
        }

        // 其余伏笔删除本章事件，并按剩余事件还原台账状态
        const touched = db
          .prepare(
            `SELECT DISTINCT fe.foreshadow_id AS id
             FROM foreshadow_events fe
             JOIN foreshadows f ON f.id = fe.foreshadow_id
             WHERE f.novel_id = ? AND fe.chapter_no = ?`,
          )
          .all(novelId, chapterNo) as Array<{ id: string }>;
        for (const { id } of touched) {
          db.prepare(
            "DELETE FROM foreshadow_events WHERE foreshadow_id = ? AND chapter_no = ?",
          ).run(id, chapterNo);
          const last = db
            .prepare(
              `SELECT event, chapter_no FROM foreshadow_events
               WHERE foreshadow_id = ?
               ORDER BY chapter_no DESC, created_at DESC LIMIT 1`,
            )
            .get(id) as { event: ForeshadowEventKind; chapter_no: number } | undefined;
          db.prepare(
            "UPDATE foreshadows SET status = ?, resolved_chapter_no = ?, updated_at = ? WHERE id = ?",
          ).run(
            last?.event ?? "planted",
            last?.event === "resolved" ? last.chapter_no : null,
            nowIso(),
            id,
          );
        }

        db.prepare(
          "DELETE FROM canon_facts WHERE novel_id = ? AND established_chapter_no = ?",
        ).run(novelId, chapterNo);

        stores.summaries.remove(novelId, "chapter", chapterNo);
      });
      rollback();
    },
  };
}
