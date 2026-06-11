import type { Database } from "better-sqlite3";

import { newId, nowIso } from "./ids.js";
import type {
  AgentRunRecord,
  WorkflowRun,
  WorkflowRunStatus,
  WorkflowStepRecord,
  WorkflowStepStatus,
} from "./types.js";

interface RunRow {
  id: string;
  novel_id: string;
  workflow_id: string;
  status: WorkflowRunStatus;
  input_json: string;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface StepRow {
  id: string;
  run_id: string;
  step_id: string;
  seq: number;
  status: WorkflowStepStatus;
  output_json: string | null;
  attempts: number;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface RunStore {
  createRun(novelId: string, workflowId: string, input: unknown): WorkflowRun;
  getRun(runId: string): WorkflowRun | undefined;
  setRunStatus(runId: string, status: WorkflowRunStatus, error?: string): void;
  /** 最近一个 running/failed 的残留 run（用于断点恢复提示） */
  findInterruptedRun(novelId: string): WorkflowRun | undefined;

  upsertStep(input: {
    runId: string;
    stepId: string;
    seq: number;
    status: WorkflowStepStatus;
    output?: unknown;
    attempts?: number;
    error?: string;
    startedAt?: string;
    finishedAt?: string;
  }): void;
  getSteps(runId: string): WorkflowStepRecord[];

  recordAgentRun(record: Omit<AgentRunRecord, "id" | "createdAt">): void;
  /** 累计 token 用量（可选起始时间） */
  usageTotals(novelId: string, sinceIso?: string): { totalTokens: number; callCount: number };
}

export function createRunStore(db: Database): RunStore {
  function toRun(row: RunRow): WorkflowRun {
    return {
      id: row.id,
      novelId: row.novel_id,
      workflowId: row.workflow_id,
      status: row.status,
      input: JSON.parse(row.input_json) as unknown,
      error: row.error ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function toStep(row: StepRow): WorkflowStepRecord {
    return {
      id: row.id,
      runId: row.run_id,
      stepId: row.step_id,
      seq: row.seq,
      status: row.status,
      output: row.output_json ? (JSON.parse(row.output_json) as unknown) : undefined,
      attempts: row.attempts,
      error: row.error ?? undefined,
      startedAt: row.started_at ?? undefined,
      finishedAt: row.finished_at ?? undefined,
    };
  }

  return {
    createRun(novelId, workflowId, input) {
      const run: WorkflowRun = {
        id: newId("run"),
        novelId,
        workflowId,
        status: "running",
        input,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.prepare(
        `INSERT INTO workflow_runs (id, novel_id, workflow_id, status, input_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        run.id,
        run.novelId,
        run.workflowId,
        run.status,
        JSON.stringify(run.input),
        run.createdAt,
        run.updatedAt,
      );
      return run;
    },

    getRun(runId) {
      const row = db.prepare("SELECT * FROM workflow_runs WHERE id = ?").get(runId) as
        | RunRow
        | undefined;
      return row ? toRun(row) : undefined;
    },

    setRunStatus(runId, status, error) {
      db.prepare(
        "UPDATE workflow_runs SET status = ?, error = ?, updated_at = ? WHERE id = ?",
      ).run(status, error ?? null, nowIso(), runId);
    },

    findInterruptedRun(novelId) {
      const row = db
        .prepare(
          `SELECT * FROM workflow_runs
           WHERE novel_id = ? AND status IN ('running', 'failed')
           ORDER BY updated_at DESC LIMIT 1`,
        )
        .get(novelId) as RunRow | undefined;
      return row ? toRun(row) : undefined;
    },

    upsertStep(input) {
      const existing = db
        .prepare("SELECT * FROM workflow_steps WHERE run_id = ? AND step_id = ?")
        .get(input.runId, input.stepId) as StepRow | undefined;

      if (existing) {
        db.prepare(
          `UPDATE workflow_steps
           SET status = ?, output_json = ?, attempts = ?, error = ?, started_at = ?, finished_at = ?
           WHERE id = ?`,
        ).run(
          input.status,
          input.output !== undefined ? JSON.stringify(input.output) : existing.output_json,
          input.attempts ?? existing.attempts,
          input.error ?? null,
          input.startedAt ?? existing.started_at,
          input.finishedAt ?? existing.finished_at,
          existing.id,
        );
        return;
      }

      db.prepare(
        `INSERT INTO workflow_steps
           (id, run_id, step_id, seq, status, output_json, attempts, error, started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        newId("step"),
        input.runId,
        input.stepId,
        input.seq,
        input.status,
        input.output !== undefined ? JSON.stringify(input.output) : null,
        input.attempts ?? 0,
        input.error ?? null,
        input.startedAt ?? null,
        input.finishedAt ?? null,
      );
    },

    getSteps(runId) {
      const rows = db
        .prepare("SELECT * FROM workflow_steps WHERE run_id = ? ORDER BY seq")
        .all(runId) as StepRow[];
      return rows.map(toStep);
    },

    recordAgentRun(record) {
      db.prepare(
        `INSERT INTO agent_runs
           (id, novel_id, workflow_run_id, step_id, capability_id, provider, model,
            prompt_tokens, completion_tokens, total_tokens, duration_ms, status, error, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        newId("arun"),
        record.novelId ?? null,
        record.workflowRunId ?? null,
        record.stepId ?? null,
        record.capabilityId,
        record.provider,
        record.model,
        record.promptTokens ?? null,
        record.completionTokens ?? null,
        record.totalTokens ?? null,
        record.durationMs,
        record.status,
        record.error ?? null,
        nowIso(),
      );
    },

    usageTotals(novelId, sinceIso) {
      const row = db
        .prepare(
          `SELECT COALESCE(SUM(total_tokens), 0) AS total, COUNT(*) AS count
           FROM agent_runs
           WHERE novel_id = ? AND created_at >= ?`,
        )
        .get(novelId, sinceIso ?? "") as { total: number; count: number };
      return { totalTokens: row.total, callCount: row.count };
    },
  };
}
