import type { Database } from "better-sqlite3";

export const SCHEMA_VERSION = 2;

const DDL = `
CREATE TABLE novels (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  genre         TEXT,
  brief         TEXT,
  status        TEXT NOT NULL DEFAULT 'setup',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE novel_assets (
  id            TEXT PRIMARY KEY,
  novel_id      TEXT NOT NULL REFERENCES novels(id),
  kind          TEXT NOT NULL,
  version       INTEGER NOT NULL,
  content_json  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TEXT NOT NULL,
  UNIQUE (novel_id, kind, version)
);

CREATE TABLE outlines (
  id            TEXT PRIMARY KEY,
  novel_id      TEXT NOT NULL REFERENCES novels(id),
  scope         TEXT NOT NULL,
  volume_no     INTEGER,
  version       INTEGER NOT NULL,
  content_json  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft',
  revision_note TEXT,
  created_at    TEXT NOT NULL,
  UNIQUE (novel_id, scope, volume_no, version)
);

CREATE TABLE chapters (
  id                 TEXT PRIMARY KEY,
  novel_id           TEXT NOT NULL REFERENCES novels(id),
  volume_no          INTEGER NOT NULL,
  chapter_no         INTEGER NOT NULL,
  title              TEXT,
  status             TEXT NOT NULL DEFAULT 'planned',
  plan_json          TEXT,
  confirmed_draft_id TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  UNIQUE (novel_id, chapter_no)
);

CREATE TABLE chapter_drafts (
  id            TEXT PRIMARY KEY,
  chapter_id    TEXT NOT NULL REFERENCES chapters(id),
  version       INTEGER NOT NULL,
  content       TEXT NOT NULL,
  word_count    INTEGER NOT NULL,
  source        TEXT NOT NULL,
  review_json   TEXT,
  created_at    TEXT NOT NULL,
  UNIQUE (chapter_id, version)
);

CREATE TABLE foreshadows (
  id                    TEXT PRIMARY KEY,
  novel_id              TEXT NOT NULL REFERENCES novels(id),
  title                 TEXT NOT NULL,
  description           TEXT NOT NULL,
  importance            TEXT NOT NULL DEFAULT 'minor',
  status                TEXT NOT NULL DEFAULT 'planted',
  planted_chapter_no    INTEGER NOT NULL,
  expected_resolve_from INTEGER,
  expected_resolve_to   INTEGER,
  resolved_chapter_no   INTEGER,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);

CREATE TABLE foreshadow_events (
  id            TEXT PRIMARY KEY,
  foreshadow_id TEXT NOT NULL REFERENCES foreshadows(id),
  chapter_no    INTEGER NOT NULL,
  event         TEXT NOT NULL,
  note          TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE characters (
  id               TEXT PRIMARY KEY,
  novel_id         TEXT NOT NULL REFERENCES novels(id),
  name             TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'minor',
  profile_json     TEXT NOT NULL,
  first_chapter_no INTEGER,
  created_at       TEXT NOT NULL,
  UNIQUE (novel_id, name)
);

CREATE TABLE character_states (
  id            TEXT PRIMARY KEY,
  character_id  TEXT NOT NULL REFERENCES characters(id),
  chapter_no    INTEGER NOT NULL,
  goal          TEXT,
  emotion       TEXT,
  relationships TEXT,
  physical      TEXT,
  knowledge     TEXT,
  change_note   TEXT,
  created_at    TEXT NOT NULL,
  UNIQUE (character_id, chapter_no)
);

CREATE TABLE summaries (
  id                TEXT PRIMARY KEY,
  novel_id          TEXT NOT NULL REFERENCES novels(id),
  level             TEXT NOT NULL,
  ref_no            INTEGER,
  content           TEXT NOT NULL,
  covers_to_chapter INTEGER,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  UNIQUE (novel_id, level, ref_no)
);

CREATE TABLE canon_facts (
  id                     TEXT PRIMARY KEY,
  novel_id               TEXT NOT NULL REFERENCES novels(id),
  category               TEXT NOT NULL,
  subject                TEXT NOT NULL,
  fact                   TEXT NOT NULL,
  established_chapter_no INTEGER NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'active',
  created_at             TEXT NOT NULL
);

CREATE TABLE workflow_runs (
  id          TEXT PRIMARY KEY,
  novel_id    TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  status      TEXT NOT NULL,
  input_json  TEXT NOT NULL,
  error       TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE workflow_steps (
  id          TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL REFERENCES workflow_runs(id),
  step_id     TEXT NOT NULL,
  seq         INTEGER NOT NULL,
  status      TEXT NOT NULL,
  output_json TEXT,
  attempts    INTEGER NOT NULL DEFAULT 0,
  error       TEXT,
  started_at  TEXT,
  finished_at TEXT,
  UNIQUE (run_id, step_id)
);

CREATE TABLE agent_runs (
  id                TEXT PRIMARY KEY,
  novel_id          TEXT,
  workflow_run_id   TEXT,
  step_id           TEXT,
  capability_id     TEXT NOT NULL,
  provider          TEXT NOT NULL,
  model             TEXT NOT NULL,
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  total_tokens      INTEGER,
  duration_ms       INTEGER NOT NULL,
  status            TEXT NOT NULL,
  error             TEXT,
  created_at        TEXT NOT NULL
);

CREATE INDEX idx_chapters_novel ON chapters(novel_id, chapter_no);
CREATE INDEX idx_drafts_chapter ON chapter_drafts(chapter_id, version);
CREATE INDEX idx_foreshadows_novel ON foreshadows(novel_id, status);
CREATE INDEX idx_states_char ON character_states(character_id, chapter_no);
CREATE INDEX idx_canon_subject ON canon_facts(novel_id, subject);
CREATE INDEX idx_agent_runs_novel ON agent_runs(novel_id, created_at);
`;

export function ensureSchema(db: Database): void {
  const version = db.pragma("user_version", { simple: true }) as number;
  if (version === SCHEMA_VERSION) {
    return;
  }

  const hasTables =
    (db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get() as {
      n: number;
    }).n > 0;
  if (hasTables) {
    throw new Error(
      `数据库 schema 版本不匹配（当前 ${version}，需要 ${SCHEMA_VERSION}）。` +
        "请删除旧数据库文件或通过 NOVEL_DB_PATH 指定新路径。",
    );
  }

  db.exec(DDL);
  db.pragma(`user_version = ${SCHEMA_VERSION}`);
}
