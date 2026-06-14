import {
  runWorkflow,
  type RunOptions,
  type WorkflowDefinition,
  type WorkflowRunResult,
} from "@ai-novel-agents/workflow";

import type { AppContext } from "./context.js";
import { createProgressRenderer } from "./render/progress.js";

/** 运行一条 workflow 并把进度/流式正文渲染到终端 */
export async function runWf<TInput>(
  ctx: AppContext,
  definition: WorkflowDefinition<TInput>,
  input: TInput,
  options?: RunOptions,
): Promise<WorkflowRunResult> {
  const renderer = createProgressRenderer();
  return runWorkflow(
    definition,
    input,
    { store: ctx.store, models: ctx.models, onEvent: renderer.onEvent },
    options,
  );
}
