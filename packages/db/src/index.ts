import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type NovelStage = "立项" | "大纲" | "连载" | "修订" | "归档";
export type QualityState = "健康" | "关注" | "风险";
export type TaskStatus = "queued" | "running" | "waiting_for_user" | "succeeded" | "failed" | "cancelled";
export type StoredChapterContextStatus = "draft" | "confirmed";
export type PreflightAssetKind = "foundation" | "setting" | "outline";
export type PreflightAssetStatus = "草稿" | "待确认" | "已确认" | "需修订";
export type OutlineRevisionStatus = "待确认" | "需修订" | "已确认";
export type OutlineRevisionScope = "master" | "volume";

export interface CreateNovelInput {
  title?: string;
  genre?: string;
  seedIdea: string;
  targetWords: number;
}

export interface SavePreflightAssetInput<TAsset = unknown> {
  novelId: string;
  kind: PreflightAssetKind;
  status: PreflightAssetStatus;
  asset: TAsset;
}

export interface StoredPreflightAsset<TAsset = unknown> extends SavePreflightAssetInput<TAsset> {
  updatedAt: string;
}

export interface SaveOutlineRevisionVersionInput<TVersion = unknown> {
  novelId: string;
  versionId: string;
  sourceVersionId?: string;
  status: OutlineRevisionStatus;
  scope: OutlineRevisionScope;
  targetVolumeId?: string;
  version: TVersion;
  createdAt: string;
}

export type StoredOutlineRevisionVersion<TVersion = unknown> =
  SaveOutlineRevisionVersionInput<TVersion>;

export interface ConfirmNovelOutlineInput<
  TFoundation = unknown,
  TSetting = unknown,
  TOutline extends PersistedOutlineShape = PersistedOutlineShape,
> {
  novelId: string;
  foundation: TFoundation;
  setting: TSetting;
  outline: TOutline;
  chapterPlans: StoredChapterPlan[];
  selectedVersionId?: string;
  novel: {
    title: string;
    hook: string;
    targetReaders: string;
    targetWords: number;
    totalChapters: number;
    currentVolume: string;
  };
  task: StoredWorkflowTask;
}

export interface UpdateNovelInput {
  title?: string;
  hook?: string;
  genre?: string;
}

export interface StoredNovel {
  novelId: string;
  title: string;
  genre: string;
  stage: NovelStage;
  hook: string;
  targetReaders: string;
  totalChapters: number;
  completedChapters: number;
  qualityScore: number;
  qualityState: QualityState;
  archived: boolean;
  updatedAt: string;
  recentTask: string;
  currentVolume: string;
  targetWords: number;
}

export interface StoredWorkflowTask {
  taskId: string;
  novelId: string;
  title: string;
  workflowName: string;
  status: TaskStatus;
  inputSnapshot: string;
  outputSnapshot: string;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface StoredChapterPlan {
  id: string;
  novelId: string;
  chapterNo: number;
  title: string;
  volumeId?: string;
  volumeTitle: string;
  objective: string;
  hook: string;
  status: string;
}

export interface SaveChapterContextInput {
  novelId: string;
  chapterNo: number;
  title: string;
  summary: string;
  content: string;
  endingHook?: string;
  endingExcerpt?: string;
  status: StoredChapterContextStatus;
}

export interface StoredChapterContext {
  novelId: string;
  chapterNo: number;
  title: string;
  summary: string;
  content: string;
  endingHook?: string;
  endingExcerpt: string;
  status: StoredChapterContextStatus;
  updatedAt: string;
}

export interface PersistedOutlineShape {
  novelId: string;
  volumes?: Array<{ title?: string }>;
}

export interface StoredOutlineResult<TOutline = unknown> {
  task: StoredWorkflowTask;
  outline: TOutline & PersistedOutlineShape;
  chapterPlans: StoredChapterPlan[];
}

interface NovelRow {
  novel_id: string;
  title: string;
  genre: string;
  stage: NovelStage;
  hook: string;
  target_readers: string;
  total_chapters: number;
  completed_chapters: number;
  quality_score: number;
  quality_state: QualityState;
  archived: 0 | 1;
  updated_at: string;
  recent_task: string;
  current_volume: string;
  target_words: number;
}

interface OutlineRow {
  outline_json: string;
}

interface TaskRow {
  task_id: string;
  novel_id: string;
  title: string;
  workflow_name: string;
  status: TaskStatus;
  input_snapshot: string;
  output_snapshot: string;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

interface ChapterPlanRow {
  id: string;
  novel_id: string;
  chapter_no: number;
  title: string;
  volume_id?: string | null;
  volume_title: string;
  objective: string;
  hook: string;
  status: string;
}

interface ChapterContextRow {
  novel_id: string;
  chapter_no: number;
  title: string;
  summary: string;
  content: string;
  ending_hook: string | null;
  ending_excerpt: string;
  status: StoredChapterContextStatus;
  updated_at: string;
}

interface PreflightAssetRow {
  novel_id: string;
  kind: PreflightAssetKind;
  status: PreflightAssetStatus;
  asset_json: string;
  updated_at: string;
}

interface OutlineRevisionVersionRow {
  novel_id: string;
  version_id: string;
  source_version_id: string | null;
  status: OutlineRevisionStatus;
  scope: OutlineRevisionScope;
  target_volume_id: string | null;
  version_json: string;
  created_at: string;
}

export class NovelDatabase {
  private readonly db: Database.Database;

  constructor(dbPath = defaultDatabasePath()) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initialize();
  }

  listNovels(): StoredNovel[] {
    const rows = this.db
      .prepare("SELECT * FROM novels ORDER BY updated_at DESC")
      .all() as NovelRow[];
    return rows.map(mapNovelRow);
  }

  getNovel(novelId: string): StoredNovel | null {
    const row = this.db
      .prepare("SELECT * FROM novels WHERE novel_id = ?")
      .get(novelId) as NovelRow | undefined;
    return row ? mapNovelRow(row) : null;
  }

  listTasks(novelId: string, status?: TaskStatus): StoredWorkflowTask[] {
    const rows = status
      ? (this.db
          .prepare(
            `SELECT * FROM workflow_tasks
             WHERE novel_id = ? AND status = ?
             ORDER BY COALESCE(finished_at, started_at) DESC`,
          )
          .all(novelId, status) as TaskRow[])
      : (this.db
          .prepare(
            `SELECT * FROM workflow_tasks
             WHERE novel_id = ?
             ORDER BY COALESCE(finished_at, started_at) DESC`,
          )
          .all(novelId) as TaskRow[]);

    return rows.map(mapTaskRow);
  }

  getTask(taskId: string): StoredWorkflowTask | null {
    const row = this.db
      .prepare("SELECT * FROM workflow_tasks WHERE task_id = ?")
      .get(taskId) as TaskRow | undefined;
    return row ? mapTaskRow(row) : null;
  }

  saveWorkflowTask(task: StoredWorkflowTask): StoredWorkflowTask {
    if (!this.getNovel(task.novelId)) {
      throw new Error(`未找到小说项目：${task.novelId}`);
    }

    this.db
      .prepare(
        `INSERT INTO workflow_tasks (
          task_id, novel_id, title, workflow_name, status, input_snapshot,
          output_snapshot, error, started_at, finished_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(task_id) DO UPDATE SET
          status = excluded.status,
          output_snapshot = excluded.output_snapshot,
          error = excluded.error,
          finished_at = excluded.finished_at`,
      )
      .run(
        task.taskId,
        task.novelId,
        task.title,
        task.workflowName,
        task.status,
        task.inputSnapshot,
        task.outputSnapshot,
        task.error ?? null,
        task.startedAt,
        task.finishedAt ?? null,
      );

    return this.getTask(task.taskId) ?? task;
  }

  saveChapterContext(input: SaveChapterContextInput): StoredChapterContext {
    const novel = this.getNovel(input.novelId);
    if (!novel) {
      throw new Error(`未找到小说项目：${input.novelId}`);
    }

    const now = new Date().toISOString();
    const endingExcerpt = input.endingExcerpt?.trim() || buildEndingExcerpt(input.content);
    this.db
      .prepare(
        `INSERT INTO chapter_contexts (
          novel_id, chapter_no, title, summary, content, ending_hook,
          ending_excerpt, status, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(novel_id, chapter_no) DO UPDATE SET
          title = excluded.title,
          summary = excluded.summary,
          content = excluded.content,
          ending_hook = excluded.ending_hook,
          ending_excerpt = excluded.ending_excerpt,
          status = excluded.status,
          updated_at = excluded.updated_at`,
      )
      .run(
        input.novelId,
        input.chapterNo,
        input.title,
        input.summary,
        input.content,
        input.endingHook?.trim() || null,
        endingExcerpt,
        input.status,
        now,
      );

    const saved = this.getChapterContext(input.novelId, input.chapterNo);
    if (!saved) {
      throw new Error("章节上下文保存失败。");
    }
    return saved;
  }

  getChapterContext(novelId: string, chapterNo: number): StoredChapterContext | null {
    const row = this.db
      .prepare("SELECT * FROM chapter_contexts WHERE novel_id = ? AND chapter_no = ?")
      .get(novelId, chapterNo) as ChapterContextRow | undefined;
    return row ? mapChapterContextRow(row) : null;
  }

  listChapterContexts(novelId: string, status?: StoredChapterContextStatus): StoredChapterContext[] {
    const rows = status
      ? (this.db
          .prepare(
            `SELECT * FROM chapter_contexts
             WHERE novel_id = ? AND status = ?
             ORDER BY chapter_no ASC`,
          )
          .all(novelId, status) as ChapterContextRow[])
      : (this.db
          .prepare(
            `SELECT * FROM chapter_contexts
             WHERE novel_id = ?
             ORDER BY chapter_no ASC`,
          )
          .all(novelId) as ChapterContextRow[]);

    return rows.map(mapChapterContextRow);
  }

  queueTaskRetry(taskId: string): StoredWorkflowTask | null {
    const task = this.getTask(taskId);
    if (!task || task.status !== "failed") {
      return task;
    }

    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE workflow_tasks
         SET status = 'queued',
             error = NULL,
             output_snapshot = '已重新加入本地任务队列。',
             started_at = ?,
             finished_at = NULL
         WHERE task_id = ?`,
      )
      .run(now, taskId);

    return this.getTask(taskId);
  }

  createEmptyNovel(): StoredNovel {
    const now = new Date().toISOString();
    const novel: StoredNovel = {
      novelId: `novel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: "",
      genre: "",
      stage: "立项",
      hook: "",
      targetReaders: "",
      totalChapters: 0,
      completedChapters: 0,
      qualityScore: 0,
      qualityState: "关注",
      archived: false,
      updatedAt: now,
      recentTask: "空小说项目已创建，等待用户提供初步想法",
      currentVolume: "",
      targetWords: 0,
    };

    this.insertNovel(novel);
    return novel;
  }

  createNovel(input: CreateNovelInput): StoredNovel {
    const now = new Date().toISOString();
    const hook = input.seedIdea.trim();
    const genre = input.genre?.trim() || "待定题材";
    const title = input.title?.trim() || buildAutoTitle(genre, hook);
    const targetWords = input.targetWords;
    const totalChapters = estimateChapters(targetWords);
    const novel: StoredNovel = {
      novelId: `novel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      genre,
      stage: "大纲",
      hook,
      targetReaders: inferTargetReaders(genre),
      totalChapters,
      completedChapters: 0,
      qualityScore: 72,
      qualityState: "关注",
      archived: false,
      updatedAt: now,
      recentTask: "新建小说已创建，等待首次大纲生成",
      currentVolume: "第一卷：待命名",
      targetWords,
    };

    this.insertNovel(novel);

    return novel;
  }

  savePreflightAsset<TAsset>(
    input: SavePreflightAssetInput<TAsset>,
  ): StoredPreflightAsset<TAsset> {
    if (!this.getNovel(input.novelId)) {
      throw new Error(`未找到小说项目：${input.novelId}`);
    }

    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO preflight_assets (novel_id, kind, status, asset_json, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(novel_id, kind) DO UPDATE SET
           status = excluded.status,
           asset_json = excluded.asset_json,
           updated_at = excluded.updated_at`,
      )
      .run(input.novelId, input.kind, input.status, JSON.stringify(input.asset), now);

    return { ...input, updatedAt: now };
  }

  getPreflightAsset<TAsset>(
    novelId: string,
    kind: PreflightAssetKind,
  ): StoredPreflightAsset<TAsset> | null {
    const row = this.db
      .prepare("SELECT * FROM preflight_assets WHERE novel_id = ? AND kind = ?")
      .get(novelId, kind) as PreflightAssetRow | undefined;
    if (!row) {
      return null;
    }

    return {
      novelId: row.novel_id,
      kind: row.kind,
      status: row.status,
      asset: JSON.parse(row.asset_json) as TAsset,
      updatedAt: row.updated_at,
    };
  }

  saveOutlineRevisionVersion<TVersion>(
    input: SaveOutlineRevisionVersionInput<TVersion>,
  ): StoredOutlineRevisionVersion<TVersion> {
    if (!this.getNovel(input.novelId)) {
      throw new Error(`未找到小说项目：${input.novelId}`);
    }
    this.db
      .prepare(
        `INSERT INTO outline_revision_versions (
          novel_id, version_id, source_version_id, status, scope,
          target_volume_id, version_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.novelId,
        input.versionId,
        input.sourceVersionId ?? null,
        input.status,
        input.scope,
        input.targetVolumeId ?? null,
        JSON.stringify(input.version),
        input.createdAt,
      );
    return input;
  }

  getOutlineRevisionVersion<TVersion>(
    novelId: string,
    versionId: string,
  ): StoredOutlineRevisionVersion<TVersion> | null {
    const row = this.db
      .prepare(
        "SELECT * FROM outline_revision_versions WHERE novel_id = ? AND version_id = ?",
      )
      .get(novelId, versionId) as OutlineRevisionVersionRow | undefined;
    return row ? mapOutlineRevisionVersionRow<TVersion>(row) : null;
  }

  listOutlineRevisionVersions<TVersion>(
    novelId: string,
  ): StoredOutlineRevisionVersion<TVersion>[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM outline_revision_versions
         WHERE novel_id = ?
         ORDER BY created_at DESC, version_id DESC`,
      )
      .all(novelId) as OutlineRevisionVersionRow[];
    return rows.map((row) => mapOutlineRevisionVersionRow<TVersion>(row));
  }

  getLatestOutlineRevisionVersion<TVersion>(
    novelId: string,
  ): StoredOutlineRevisionVersion<TVersion> | null {
    return this.listOutlineRevisionVersions<TVersion>(novelId)[0] ?? null;
  }

  updateNovel(novelId: string, input: UpdateNovelInput): StoredNovel | null {
    const novel = this.getNovel(novelId);
    if (!novel) {
      return null;
    }

    const now = new Date().toISOString();
    const next = {
      title: input.title?.trim() || novel.title,
      hook: input.hook?.trim() || novel.hook,
      genre: input.genre?.trim() || novel.genre,
      updatedAt: now,
      novelId,
    };

    this.db
      .prepare(
        `UPDATE novels
         SET title = @title,
             hook = @hook,
             genre = @genre,
             recent_task = '小说基础信息已更新',
             updated_at = @updatedAt
         WHERE novel_id = @novelId`,
      )
      .run(next);

    return this.getNovel(novelId);
  }

  saveOutlineResult(result: StoredOutlineResult): void {
    const now = new Date().toISOString();
    const save = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO outlines (novel_id, outline_json, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(novel_id) DO UPDATE SET
             outline_json = excluded.outline_json,
             updated_at = excluded.updated_at`,
        )
        .run(result.outline.novelId, JSON.stringify(result.outline), now);

      this.db.prepare("DELETE FROM chapter_plans WHERE novel_id = ?").run(result.outline.novelId);
      const insertChapter = this.db.prepare(
        `INSERT INTO chapter_plans (
          id, novel_id, chapter_no, title, volume_id, volume_title, objective, hook, status, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const plan of result.chapterPlans) {
        insertChapter.run(
          plan.id,
          plan.novelId,
          plan.chapterNo,
          plan.title,
          plan.volumeId ?? "",
          plan.volumeTitle,
          plan.objective,
          plan.hook,
          plan.status,
          now,
        );
      }

      this.db
        .prepare(
          `INSERT INTO workflow_tasks (
            task_id, novel_id, title, workflow_name, status, input_snapshot,
            output_snapshot, error, started_at, finished_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(task_id) DO UPDATE SET
            status = excluded.status,
            output_snapshot = excluded.output_snapshot,
            error = excluded.error,
            finished_at = excluded.finished_at`,
        )
        .run(
          result.task.taskId,
          result.task.novelId,
          result.task.title,
          result.task.workflowName,
          result.task.status,
          result.task.inputSnapshot,
          result.task.outputSnapshot,
          result.task.error ?? null,
          result.task.startedAt,
          result.task.finishedAt ?? null,
        );

      const currentVolume = result.outline.volumes?.[0]?.title ?? "第一卷：待命名";
      this.db
        .prepare(
          `UPDATE novels
           SET recent_task = ?, current_volume = ?, updated_at = ?
           WHERE novel_id = ?`,
        )
        .run(result.task.outputSnapshot, currentVolume, now, result.outline.novelId);
    });

    save();
  }

  confirmNovelOutline<
    TFoundation,
    TSetting,
    TOutline extends PersistedOutlineShape,
  >(
    input: ConfirmNovelOutlineInput<TFoundation, TSetting, TOutline>,
  ): StoredOutlineResult<TOutline> {
    const novel = this.getNovel(input.novelId);
    if (!novel) {
      throw new Error(`未找到小说项目：${input.novelId}`);
    }
    if (input.outline.novelId !== input.novelId) {
      throw new Error("正式大纲的 novelId 与目标小说不一致。");
    }

    const now = new Date().toISOString();
    const save = this.db.transaction(() => {
      const saveAsset = this.db.prepare(
        `INSERT INTO preflight_assets (novel_id, kind, status, asset_json, updated_at)
         VALUES (?, ?, '已确认', ?, ?)
         ON CONFLICT(novel_id, kind) DO UPDATE SET
           status = excluded.status,
           asset_json = excluded.asset_json,
           updated_at = excluded.updated_at`,
      );
      saveAsset.run(input.novelId, "foundation", JSON.stringify(input.foundation), now);
      saveAsset.run(input.novelId, "setting", JSON.stringify(input.setting), now);
      saveAsset.run(input.novelId, "outline", JSON.stringify(input.outline), now);

      this.db
        .prepare(
          `INSERT INTO outlines (novel_id, outline_json, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(novel_id) DO UPDATE SET
             outline_json = excluded.outline_json,
             updated_at = excluded.updated_at`,
        )
        .run(input.novelId, JSON.stringify(input.outline), now);

      this.db.prepare("DELETE FROM chapter_plans WHERE novel_id = ?").run(input.novelId);
      const insertChapter = this.db.prepare(
        `INSERT INTO chapter_plans (
          id, novel_id, chapter_no, title, volume_id, volume_title,
          objective, hook, status, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const plan of input.chapterPlans) {
        insertChapter.run(
          plan.id,
          plan.novelId,
          plan.chapterNo,
          plan.title,
          plan.volumeId ?? "",
          plan.volumeTitle,
          plan.objective,
          plan.hook,
          plan.status,
          now,
        );
      }

      if (input.selectedVersionId) {
        const stored = this.getOutlineRevisionVersion<Record<string, unknown>>(
          input.novelId,
          input.selectedVersionId,
        );
        if (!stored) {
          throw new Error(`未找到大纲版本：${input.selectedVersionId}`);
        }
        const storedVersion = stored.version as Record<string, unknown>;
        const revisedOutline = storedVersion.revisedOutline;
        this.db
          .prepare(
            `UPDATE outline_revision_versions
             SET status = '已确认',
                 version_json = ?
             WHERE novel_id = ? AND version_id = ?`,
          )
          .run(
            JSON.stringify({
              ...storedVersion,
              status: "已确认",
              ...(revisedOutline && typeof revisedOutline === "object"
                ? {
                    revisedOutline: {
                      ...revisedOutline,
                      status: "已确认",
                    },
                  }
                : {}),
            }),
            input.novelId,
            input.selectedVersionId,
          );
      }

      this.db
        .prepare(
          `INSERT INTO workflow_tasks (
            task_id, novel_id, title, workflow_name, status, input_snapshot,
            output_snapshot, error, started_at, finished_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(task_id) DO UPDATE SET
            status = excluded.status,
            output_snapshot = excluded.output_snapshot,
            error = excluded.error,
            finished_at = excluded.finished_at`,
        )
        .run(
          input.task.taskId,
          input.task.novelId,
          input.task.title,
          input.task.workflowName,
          input.task.status,
          input.task.inputSnapshot,
          input.task.outputSnapshot,
          input.task.error ?? null,
          input.task.startedAt,
          input.task.finishedAt ?? now,
        );

      this.db
        .prepare(
          `UPDATE novels
           SET title = ?,
               hook = ?,
               target_readers = ?,
               target_words = ?,
               total_chapters = ?,
               current_volume = ?,
               stage = '大纲',
               recent_task = ?,
               updated_at = ?
           WHERE novel_id = ?`,
        )
        .run(
          input.novel.title,
          input.novel.hook,
          input.novel.targetReaders,
          input.novel.targetWords,
          input.novel.totalChapters,
          input.novel.currentVolume,
          input.task.outputSnapshot,
          now,
          input.novelId,
        );
    });

    save();
    const result = this.getOutlineResult<TOutline>(input.novelId);
    if (!result) {
      throw new Error("正式大纲确认后读取失败。");
    }
    return result;
  }

  saveOutlineOnly(
    novelId: string,
    outline: PersistedOutlineShape,
    outputSnapshot = "已保存大纲修改。",
  ): StoredOutlineResult | null {
    const novel = this.getNovel(novelId);
    if (!novel || outline.novelId !== novelId) {
      return null;
    }

    const now = new Date().toISOString();
    const taskId = `task-outline-edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const save = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO outlines (novel_id, outline_json, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(novel_id) DO UPDATE SET
             outline_json = excluded.outline_json,
             updated_at = excluded.updated_at`,
        )
        .run(novelId, JSON.stringify(outline), now);

      this.db
        .prepare(
          `INSERT INTO workflow_tasks (
            task_id, novel_id, title, workflow_name, status, input_snapshot,
            output_snapshot, error, started_at, finished_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          taskId,
          novelId,
          "大纲修改保存",
          "outline-planning-graph",
          "succeeded",
          "用户在大纲页提交修改。",
          outputSnapshot,
          null,
          now,
          now,
        );

      const currentVolume = outline.volumes?.[0]?.title ?? novel.currentVolume;
      this.db
        .prepare(
          `UPDATE novels
           SET recent_task = ?, current_volume = ?, updated_at = ?
           WHERE novel_id = ?`,
        )
        .run(outputSnapshot, currentVolume, now, novelId);
    });

    save();
    return this.getOutlineResult(novelId);
  }

  getOutlineResult<TOutline = unknown>(novelId: string): StoredOutlineResult<TOutline> | null {
    const outlineRow = this.db
      .prepare("SELECT outline_json FROM outlines WHERE novel_id = ?")
      .get(novelId) as OutlineRow | undefined;
    if (!outlineRow) {
      return null;
    }

    const taskRow = this.db
      .prepare(
        `SELECT * FROM workflow_tasks
         WHERE novel_id = ?
         ORDER BY COALESCE(finished_at, started_at) DESC
         LIMIT 1`,
      )
      .get(novelId) as TaskRow | undefined;

    const chapterRows = this.db
      .prepare("SELECT * FROM chapter_plans WHERE novel_id = ? ORDER BY chapter_no ASC")
      .all(novelId) as ChapterPlanRow[];

    return {
      task: taskRow ? mapTaskRow(taskRow) : createSyntheticTask(novelId),
      outline: JSON.parse(outlineRow.outline_json) as TOutline & { novelId: string },
      chapterPlans: chapterRows.map(mapChapterPlanRow),
    };
  }

  private initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS novels (
        novel_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        genre TEXT NOT NULL,
        stage TEXT NOT NULL,
        hook TEXT NOT NULL,
        target_readers TEXT NOT NULL,
        total_chapters INTEGER NOT NULL,
        completed_chapters INTEGER NOT NULL DEFAULT 0,
        quality_score INTEGER NOT NULL DEFAULT 0,
        quality_state TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        recent_task TEXT NOT NULL,
        current_volume TEXT NOT NULL,
        target_words INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS outlines (
        novel_id TEXT PRIMARY KEY,
        outline_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (novel_id) REFERENCES novels(novel_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS chapter_plans (
        id TEXT PRIMARY KEY,
        novel_id TEXT NOT NULL,
        chapter_no INTEGER NOT NULL,
        title TEXT NOT NULL,
        volume_id TEXT NOT NULL DEFAULT '',
        volume_title TEXT NOT NULL,
        objective TEXT NOT NULL,
        hook TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (novel_id) REFERENCES novels(novel_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workflow_tasks (
        task_id TEXT PRIMARY KEY,
        novel_id TEXT NOT NULL,
        title TEXT NOT NULL,
        workflow_name TEXT NOT NULL,
        status TEXT NOT NULL,
        input_snapshot TEXT NOT NULL,
        output_snapshot TEXT NOT NULL,
        error TEXT,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        FOREIGN KEY (novel_id) REFERENCES novels(novel_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS chapter_contexts (
        novel_id TEXT NOT NULL,
        chapter_no INTEGER NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        content TEXT NOT NULL,
        ending_hook TEXT,
        ending_excerpt TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (novel_id, chapter_no),
        FOREIGN KEY (novel_id) REFERENCES novels(novel_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS preflight_assets (
        novel_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        asset_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (novel_id, kind),
        FOREIGN KEY (novel_id) REFERENCES novels(novel_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS outline_revision_versions (
        novel_id TEXT NOT NULL,
        version_id TEXT NOT NULL,
        source_version_id TEXT,
        status TEXT NOT NULL,
        scope TEXT NOT NULL,
        target_volume_id TEXT,
        version_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (novel_id, version_id),
        FOREIGN KEY (novel_id) REFERENCES novels(novel_id) ON DELETE CASCADE
      );

    `);
    this.ensureColumn("chapter_plans", "volume_id", "TEXT NOT NULL DEFAULT ''");
  }

  private insertNovel(novel: StoredNovel) {
    this.db
      .prepare(
        `INSERT INTO novels (
          novel_id, title, genre, stage, hook, target_readers, total_chapters,
          completed_chapters, quality_score, quality_state, archived,
          updated_at, recent_task, current_volume, target_words
        ) VALUES (
          @novelId, @title, @genre, @stage, @hook, @targetReaders, @totalChapters,
          @completedChapters, @qualityScore, @qualityState, @archived,
          @updatedAt, @recentTask, @currentVolume, @targetWords
        )`,
      )
      .run({ ...novel, archived: novel.archived ? 1 : 0 });
  }

  private ensureColumn(table: string, column: string, definition: string) {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((item) => item.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
}

export function defaultDatabasePath() {
  return resolve(process.env.DB_PATH?.trim() || "data/ai-novel-agents.sqlite");
}

export function estimateChapters(targetWords: number) {
  return Math.max(1, Math.ceil(targetWords / 3000));
}

function mapNovelRow(row: NovelRow): StoredNovel {
  return {
    novelId: row.novel_id,
    title: row.title,
    genre: row.genre,
    stage: row.stage,
    hook: row.hook,
    targetReaders: row.target_readers,
    totalChapters: row.total_chapters,
    completedChapters: row.completed_chapters,
    qualityScore: row.quality_score,
    qualityState: row.quality_state,
    archived: row.archived === 1,
    updatedAt: row.updated_at,
    recentTask: row.recent_task,
    currentVolume: row.current_volume,
    targetWords: row.target_words,
  };
}

function mapTaskRow(row: TaskRow): StoredWorkflowTask {
  return {
    taskId: row.task_id,
    novelId: row.novel_id,
    title: row.title,
    workflowName: row.workflow_name,
    status: row.status,
    inputSnapshot: row.input_snapshot,
    outputSnapshot: row.output_snapshot,
    error: row.error ?? undefined,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined,
  };
}

function mapChapterPlanRow(row: ChapterPlanRow): StoredChapterPlan {
  return {
    id: row.id,
    novelId: row.novel_id,
    chapterNo: row.chapter_no,
    title: row.title,
    volumeId: row.volume_id?.trim() || "",
    volumeTitle: row.volume_title,
    objective: row.objective,
    hook: row.hook,
    status: row.status,
  };
}

function mapOutlineRevisionVersionRow<TVersion>(
  row: OutlineRevisionVersionRow,
): StoredOutlineRevisionVersion<TVersion> {
  return {
    novelId: row.novel_id,
    versionId: row.version_id,
    sourceVersionId: row.source_version_id ?? undefined,
    status: row.status,
    scope: row.scope,
    targetVolumeId: row.target_volume_id ?? undefined,
    version: JSON.parse(row.version_json) as TVersion,
    createdAt: row.created_at,
  };
}

function mapChapterContextRow(row: ChapterContextRow): StoredChapterContext {
  return {
    novelId: row.novel_id,
    chapterNo: row.chapter_no,
    title: row.title,
    summary: row.summary,
    content: row.content,
    endingHook: row.ending_hook ?? undefined,
    endingExcerpt: row.ending_excerpt,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function buildEndingExcerpt(content: string) {
  const normalized = content.trim();
  if (normalized.length <= 600) {
    return normalized;
  }
  return normalized.slice(-600);
}

function createSyntheticTask(novelId: string): StoredWorkflowTask {
  const now = new Date().toISOString();
  return {
    taskId: `task-synthetic-${novelId}`,
    novelId,
    title: "读取已生成大纲",
    workflowName: "outline-planning-graph",
    status: "succeeded",
    inputSnapshot: "SQLite outline",
    outputSnapshot: "已读取 SQLite 中保存的大纲。",
    startedAt: now,
    finishedAt: now,
  };
}

function buildAutoTitle(genre: string, hook: string) {
  const seed = hook.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").slice(0, 4);
  return seed ? `${genre}：${seed}` : `${genre}未命名`;
}

function inferTargetReaders(genre: string) {
  if (genre.includes("悬疑")) return "偏好谜题递进、反转和强氛围的悬疑读者";
  if (genre.includes("女频")) return "偏好人物关系、情绪拉扯和成长选择的女频读者";
  if (genre.includes("科幻")) return "偏好硬设定、危机推演和文明尺度的科幻读者";
  if (genre.includes("历史")) return "偏好时代质感、权谋博弈和人物抉择的历史读者";
  if (genre.includes("无限")) return "偏好副本机制、生死压迫和智斗反转的无限流读者";
  return "偏好强钩子、快节奏和持续升级的中文网文读者";
}
