import type { Database } from "better-sqlite3";

import { newId, nowIso } from "./ids.js";
import type { Character, CharacterProfile, CharacterRole, CharacterState } from "./types.js";

interface CharacterRow {
  id: string;
  novel_id: string;
  name: string;
  role: CharacterRole;
  profile_json: string;
  first_chapter_no: number | null;
  created_at: string;
}

interface StateRow {
  id: string;
  character_id: string;
  chapter_no: number;
  goal: string | null;
  emotion: string | null;
  relationships: string | null;
  physical: string | null;
  knowledge: string | null;
  change_note: string | null;
  created_at: string;
}

export interface CharacterStore {
  /** 按名字 upsert：已存在则更新档案，否则创建 */
  upsert(input: {
    novelId: string;
    name: string;
    role: CharacterRole;
    profile: CharacterProfile;
    firstChapterNo?: number;
  }): Character;
  get(id: string): Character | undefined;
  getByName(novelId: string, name: string): Character | undefined;
  list(novelId: string): Character[];

  addState(
    characterId: string,
    chapterNo: number,
    state: Omit<CharacterState, "id" | "characterId" | "chapterNo" | "createdAt">,
  ): CharacterState;
  /** 不晚于 uptoChapterNo 的最近 limit 条状态，按章号升序返回 */
  recentStates(characterId: string, uptoChapterNo: number, limit: number): CharacterState[];
  /** 在 [fromChapterNo, toChapterNo] 内有状态变化的角色 id 列表 */
  activeCharacterIds(novelId: string, fromChapterNo: number, toChapterNo: number): string[];
}

export function createCharacterStore(db: Database): CharacterStore {
  function toCharacter(row: CharacterRow): Character {
    return {
      id: row.id,
      novelId: row.novel_id,
      name: row.name,
      role: row.role,
      profile: JSON.parse(row.profile_json) as CharacterProfile,
      firstChapterNo: row.first_chapter_no ?? undefined,
      createdAt: row.created_at,
    };
  }

  function toState(row: StateRow): CharacterState {
    return {
      id: row.id,
      characterId: row.character_id,
      chapterNo: row.chapter_no,
      goal: row.goal ?? undefined,
      emotion: row.emotion ?? undefined,
      relationships: row.relationships ?? undefined,
      physical: row.physical ?? undefined,
      knowledge: row.knowledge ?? undefined,
      changeNote: row.change_note ?? undefined,
      createdAt: row.created_at,
    };
  }

  return {
    upsert(input) {
      const existing = this.getByName(input.novelId, input.name);
      if (existing) {
        const next: Character = { ...existing, role: input.role, profile: input.profile };
        db.prepare("UPDATE characters SET role = ?, profile_json = ? WHERE id = ?").run(
          next.role,
          JSON.stringify(next.profile),
          next.id,
        );
        return next;
      }
      const character: Character = {
        id: newId("char"),
        novelId: input.novelId,
        name: input.name,
        role: input.role,
        profile: input.profile,
        firstChapterNo: input.firstChapterNo,
        createdAt: nowIso(),
      };
      db.prepare(
        `INSERT INTO characters (id, novel_id, name, role, profile_json, first_chapter_no, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        character.id,
        character.novelId,
        character.name,
        character.role,
        JSON.stringify(character.profile),
        character.firstChapterNo ?? null,
        character.createdAt,
      );
      return character;
    },

    get(id) {
      const row = db.prepare("SELECT * FROM characters WHERE id = ?").get(id) as
        | CharacterRow
        | undefined;
      return row ? toCharacter(row) : undefined;
    },

    getByName(novelId, name) {
      const row = db
        .prepare("SELECT * FROM characters WHERE novel_id = ? AND name = ?")
        .get(novelId, name) as CharacterRow | undefined;
      return row ? toCharacter(row) : undefined;
    },

    list(novelId) {
      const rows = db
        .prepare("SELECT * FROM characters WHERE novel_id = ? ORDER BY created_at")
        .all(novelId) as CharacterRow[];
      return rows.map(toCharacter);
    },

    addState(characterId, chapterNo, state) {
      const record: CharacterState = {
        id: newId("cs"),
        characterId,
        chapterNo,
        ...state,
        createdAt: nowIso(),
      };
      db.prepare(
        `INSERT INTO character_states
           (id, character_id, chapter_no, goal, emotion, relationships, physical, knowledge, change_note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        record.id,
        record.characterId,
        record.chapterNo,
        record.goal ?? null,
        record.emotion ?? null,
        record.relationships ?? null,
        record.physical ?? null,
        record.knowledge ?? null,
        record.changeNote ?? null,
        record.createdAt,
      );
      return record;
    },

    recentStates(characterId, uptoChapterNo, limit) {
      const rows = db
        .prepare(
          `SELECT * FROM character_states
           WHERE character_id = ? AND chapter_no <= ?
           ORDER BY chapter_no DESC LIMIT ?`,
        )
        .all(characterId, uptoChapterNo, limit) as StateRow[];
      return rows.map(toState).reverse();
    },

    activeCharacterIds(novelId, fromChapterNo, toChapterNo) {
      const rows = db
        .prepare(
          `SELECT DISTINCT cs.character_id AS id
           FROM character_states cs
           JOIN characters c ON c.id = cs.character_id
           WHERE c.novel_id = ? AND cs.chapter_no BETWEEN ? AND ?`,
        )
        .all(novelId, fromChapterNo, toChapterNo) as Array<{ id: string }>;
      return rows.map((row) => row.id);
    },
  };
}
