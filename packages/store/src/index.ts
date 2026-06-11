import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import Database from "better-sqlite3";

import { createAssetStore, type AssetStore } from "./assetStore.js";
import { createCanonStore, type CanonStore } from "./canonStore.js";
import { createChapterStore, type ChapterStore } from "./chapterStore.js";
import { createCharacterStore, type CharacterStore } from "./characterStore.js";
import {
  assembleChapterContext,
  type ChapterContextBundle,
} from "./context/assembleChapterContext.js";
import { createForeshadowStore, type ForeshadowStore } from "./foreshadowStore.js";
import {
  createMemoryTransaction,
  type MemoryTransaction,
} from "./memoryTransaction.js";
import { createNovelStore, type NovelStore } from "./novelStore.js";
import { createOutlineStore, type OutlineStore } from "./outlineStore.js";
import { createRunStore, type RunStore } from "./runStore.js";
import { ensureSchema } from "./schema.js";
import { createSummaryStore, type SummaryStore } from "./summaryStore.js";

export * from "./types.js";
export * from "./context/assembleChapterContext.js";
export { countWords } from "./chapterStore.js";
export type {
  AssetStore,
  CanonStore,
  ChapterStore,
  CharacterStore,
  ForeshadowStore,
  MemoryTransaction,
  NovelStore,
  OutlineStore,
  RunStore,
  SummaryStore,
};

export const DEFAULT_DB_PATH = "data/ai-novel-agents.sqlite";

export interface Store {
  novels: NovelStore;
  assets: AssetStore;
  outlines: OutlineStore;
  chapters: ChapterStore;
  foreshadows: ForeshadowStore;
  characters: CharacterStore;
  summaries: SummaryStore;
  canon: CanonStore;
  runs: RunStore;
  memory: MemoryTransaction;
  assembleChapterContext(
    novelId: string,
    chapterNo: number,
    budgetChars?: number,
  ): ChapterContextBundle;
  close(): void;
}

export function openStore(path?: string): Store {
  const dbPath = path ?? process.env.NOVEL_DB_PATH ?? DEFAULT_DB_PATH;
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(resolve(dbPath)), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);

  const novels = createNovelStore(db);
  const assets = createAssetStore(db);
  const outlines = createOutlineStore(db);
  const chapters = createChapterStore(db);
  const foreshadows = createForeshadowStore(db);
  const characters = createCharacterStore(db);
  const summaries = createSummaryStore(db);
  const canon = createCanonStore(db);
  const runs = createRunStore(db);
  const memory = createMemoryTransaction(db, { characters, foreshadows, summaries, canon });

  const contextStores = {
    novels,
    assets,
    outlines,
    chapters,
    foreshadows,
    characters,
    summaries,
    canon,
  };

  return {
    novels,
    assets,
    outlines,
    chapters,
    foreshadows,
    characters,
    summaries,
    canon,
    runs,
    memory,
    assembleChapterContext: (novelId, chapterNo, budgetChars) =>
      assembleChapterContext(contextStores, novelId, chapterNo, budgetChars),
    close: () => db.close(),
  };
}
