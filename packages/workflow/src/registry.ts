import {
  confirmChapterWorkflow,
  reviseChapterWorkflow,
  writeChapterWorkflow,
} from "./chapter.js";
import type { WorkflowDefinition } from "./engine.js";
import { generateOutlineWorkflow, reviseOutlineWorkflow } from "./outline.js";
import {
  generateFoundationWorkflow,
  generateSettingWorkflow,
  reviseAssetWorkflow,
} from "./setup.js";

/** 全部 workflow：将来的 director agent 通过名字 + JSON 输入调用 */
export const workflows = [
  generateFoundationWorkflow,
  generateSettingWorkflow,
  generateOutlineWorkflow,
  writeChapterWorkflow,
  confirmChapterWorkflow,
  reviseAssetWorkflow,
  reviseOutlineWorkflow,
  reviseChapterWorkflow,
] as unknown as Array<WorkflowDefinition<unknown>>;

export function getWorkflow(id: string): WorkflowDefinition<unknown> | undefined {
  return workflows.find((workflow) => workflow.id === id);
}

export function listWorkflows(): Array<{ id: string; title: string; inputHint: string }> {
  return workflows.map(({ id, title, inputHint }) => ({ id, title, inputHint }));
}
