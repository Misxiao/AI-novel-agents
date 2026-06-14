import type { AgentContext } from "@ai-novel-agents/agents";
import type { ModelRouter, TokenUsage } from "@ai-novel-agents/llm";
import type { Store } from "@ai-novel-agents/store";

export type WorkflowEvent =
  | { type: "run:start"; runId: string; workflowId: string; title: string }
  | { type: "step:start"; stepId: string; title: string; seq: number; total: number }
  | { type: "step:delta"; stepId: string; text: string }
  | { type: "step:done"; stepId: string; durationMs: number }
  | { type: "step:skipped"; stepId: string; title: string }
  | { type: "step:retry"; stepId: string; attempt: number; error: string }
  | { type: "run:done"; runId: string; totalUsage: TokenUsage }
  | { type: "run:failed"; runId: string; stepId: string; error: string };

export interface WorkflowDeps {
  store: Store;
  models: ModelRouter;
  onEvent?: (event: WorkflowEvent) => void;
}

export interface StepContext<TInput> {
  input: TInput;
  store: Store;
  /** 已接好流式透出与用量落库的 agent 上下文 */
  agents: AgentContext;
  /** 读取已完成步骤的输出（本次执行或断点恢复的检查点） */
  prior<T>(stepId: string): T;
}

export interface WorkflowStep<TInput> {
  id: string;
  title: string;
  /** 步骤级重试次数（JSON 解析失败等），默认 0 */
  retries?: number;
  run(ctx: StepContext<TInput>): Promise<unknown>;
}

export interface WorkflowDefinition<TInput> {
  id: string;
  title: string;
  /** 中文输入说明（给将来的 director agent 看） */
  inputHint: string;
  novelId(input: TInput): string;
  steps: Array<WorkflowStep<TInput>>;
}

export interface WorkflowRunResult {
  runId: string;
  status: "completed" | "failed";
  error?: string;
  failedStepId?: string;
  outputs: Record<string, unknown>;
  totalUsage: TokenUsage;
}

export interface RunOptions {
  /** 断点恢复：加载该 run 已完成步骤的检查点，从断点继续 */
  resumeRunId?: string;
}

export async function runWorkflow<TInput>(
  definition: WorkflowDefinition<TInput>,
  input: TInput,
  deps: WorkflowDeps,
  options: RunOptions = {},
): Promise<WorkflowRunResult> {
  const { store, models } = deps;
  const emit = (event: WorkflowEvent) => deps.onEvent?.(event);
  const novelId = definition.novelId(input);

  const outputs: Record<string, unknown> = {};
  const completedSteps = new Set<string>();
  let runId: string;

  if (options.resumeRunId) {
    const existing = store.runs.getRun(options.resumeRunId);
    if (!existing || existing.workflowId !== definition.id) {
      throw new Error(`无法恢复运行：${options.resumeRunId}`);
    }
    runId = existing.id;
    input = existing.input as TInput;
    for (const step of store.runs.getSteps(runId)) {
      if (step.status === "completed") {
        outputs[step.stepId] = step.output;
        completedSteps.add(step.stepId);
      }
    }
    store.runs.setRunStatus(runId, "running");
  } else {
    runId = store.runs.createRun(novelId, definition.id, input).id;
  }

  emit({ type: "run:start", runId, workflowId: definition.id, title: definition.title });

  const totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let currentStepId = "";

  const agents: AgentContext = {
    model: models,
    onDelta: (text) => emit({ type: "step:delta", stepId: currentStepId, text }),
    onUsage: (report) => {
      totalUsage.promptTokens! += report.usage?.promptTokens ?? 0;
      totalUsage.completionTokens! += report.usage?.completionTokens ?? 0;
      totalUsage.totalTokens! += report.usage?.totalTokens ?? 0;
      store.runs.recordAgentRun({
        novelId,
        workflowRunId: runId,
        stepId: currentStepId,
        capabilityId: report.capabilityId,
        provider: report.provider,
        model: report.model,
        promptTokens: report.usage?.promptTokens,
        completionTokens: report.usage?.completionTokens,
        totalTokens: report.usage?.totalTokens,
        durationMs: report.durationMs,
        status: "ok",
      });
    },
  };

  const stepContext: StepContext<TInput> = {
    input,
    store,
    agents,
    prior<T>(stepId: string): T {
      if (!(stepId in outputs)) {
        throw new Error(`步骤 ${currentStepId} 读取了未完成步骤的输出：${stepId}`);
      }
      return outputs[stepId] as T;
    },
  };

  for (const [index, step] of definition.steps.entries()) {
    if (completedSteps.has(step.id)) {
      emit({ type: "step:skipped", stepId: step.id, title: step.title });
      continue;
    }

    currentStepId = step.id;
    const seq = index + 1;
    emit({
      type: "step:start",
      stepId: step.id,
      title: step.title,
      seq,
      total: definition.steps.length,
    });
    const startedAt = new Date().toISOString();
    store.runs.upsertStep({ runId, stepId: step.id, seq, status: "running", startedAt });

    const maxAttempts = (step.retries ?? 0) + 1;
    let lastError: unknown;
    let succeeded = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const output = await step.run(stepContext);
        outputs[step.id] = output;
        store.runs.upsertStep({
          runId,
          stepId: step.id,
          seq,
          status: "completed",
          output: output ?? null,
          attempts: attempt,
          finishedAt: new Date().toISOString(),
        });
        emit({
          type: "step:done",
          stepId: step.id,
          durationMs: Date.now() - Date.parse(startedAt),
        });
        succeeded = true;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          emit({
            type: "step:retry",
            stepId: step.id,
            attempt,
            error: errorMessage(error),
          });
        }
      }
    }

    if (!succeeded) {
      const message = errorMessage(lastError);
      store.runs.upsertStep({
        runId,
        stepId: step.id,
        seq,
        status: "failed",
        attempts: maxAttempts,
        error: message,
        finishedAt: new Date().toISOString(),
      });
      store.runs.setRunStatus(runId, "failed", message);
      emit({ type: "run:failed", runId, stepId: step.id, error: message });
      return {
        runId,
        status: "failed",
        error: message,
        failedStepId: step.id,
        outputs,
        totalUsage,
      };
    }
  }

  store.runs.setRunStatus(runId, "completed");
  emit({ type: "run:done", runId, totalUsage });
  return { runId, status: "completed", outputs, totalUsage };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
